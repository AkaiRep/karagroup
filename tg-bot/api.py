import aiohttp
from config import settings


class BackendAPI:
    def __init__(self):
        self._token: str | None = None
        self._session: aiohttp.ClientSession | None = None

    async def _session_(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession()
        return self._session

    async def _get_token(self) -> str:
        if self._token:
            return self._token
        session = await self._session_()
        async with session.post(
            f"{settings.BACKEND_URL}/auth/login",
            json={"username": settings.BACKEND_USERNAME, "password": settings.BACKEND_PASSWORD},
        ) as r:
            data = await r.json()
            self._token = data["access_token"]
        return self._token

    async def _request(self, method: str, path: str, **kwargs) -> dict | list:
        token = await self._get_token()
        session = await self._session_()
        headers = {"Authorization": f"Bearer {token}"}

        async with getattr(session, method)(
            f"{settings.BACKEND_URL}{path}", headers=headers, **kwargs
        ) as r:
            if r.status == 401:
                # Token expired — refresh once
                self._token = None
                token = await self._get_token()
                headers = {"Authorization": f"Bearer {token}"}
                async with getattr(session, method)(
                    f"{settings.BACKEND_URL}{path}", headers=headers, **kwargs
                ) as r2:
                    return await r2.json()
            return await r.json()

    # ── Categories ────────────────────────────────────────────────────────────

    async def get_categories(self) -> list:
        return await self._request("get", "/categories/")

    # ── Products ──────────────────────────────────────────────────────────────

    async def get_products(self, active_only: bool = True) -> list:
        return await self._request("get", "/products/", params={"active_only": str(active_only).lower()})

    async def get_global_discount(self) -> dict:
        return await self._request("get", "/products/global-discount")

    # ── Orders ────────────────────────────────────────────────────────────────

    async def create_order(self, data: dict) -> dict:
        return await self._request("post", "/orders/", json=data)

    async def create_payment(self, order_id: int) -> dict:
        return await self._request("post", f"/payments/create/{order_id}")

    async def lookup_promo_code(self, code: str) -> dict:
        return await self._request("get", f"/media/promo-codes/lookup/{code}")

    async def update_tg_notify(self, order_id: int, data: dict) -> dict:
        return await self._request("patch", f"/orders/{order_id}/tg-notify", json=data)

    async def get_tg_pending_updates(self) -> list:
        return await self._request("get", "/orders/tg-pending-updates")

    async def get_user_orders(self, telegram_user_id: int) -> list:
        return await self._request("get", "/orders/", params={"telegram_user_id": telegram_user_id})

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def close(self):
        if self._session and not self._session.closed:
            await self._session.close()


api = BackendAPI()
