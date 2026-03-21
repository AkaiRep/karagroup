from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from models import UserRole, OrderSource, OrderStatus, TransactionStatus


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str
    version: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ── User ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: Optional[str] = None
    password: str = Field(..., min_length=6)
    role: UserRole = UserRole.worker
    worker_percentage: float = Field(70.0, ge=0, le=100)
    is_vip: bool = False


class UserUpdate(BaseModel):
    email: Optional[str] = None
    worker_percentage: Optional[float] = Field(None, ge=0, le=100)
    is_vip: Optional[bool] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str]
    role: UserRole
    worker_percentage: float
    is_vip: bool
    is_active: bool
    telegram_id: Optional[int]
    last_seen_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class WorkerStatsOut(BaseModel):
    user_id: int
    username: str
    is_online: bool
    last_seen_at: Optional[datetime]
    total_online_seconds: int
    total_orders: int
    completed_orders: int
    avg_order_seconds: Optional[float]
    total_order_seconds: int


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class CategoryOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Product ───────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=256)
    description: Optional[str] = None
    price: float = Field(..., gt=0)
    discount_percent: float = Field(0.0, ge=0, le=100)
    category_id: Optional[int] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = Field(None, gt=0)
    is_active: Optional[bool] = None
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    category_id: Optional[int] = None
    image_url: Optional[str] = None


class ProductOut(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    discount_percent: float
    is_active: bool
    category_id: Optional[int]
    image_url: Optional[str]
    order_count: int = 0
    category: Optional[CategoryOut]
    created_at: datetime

    model_config = {"from_attributes": True}


class GlobalDiscountOut(BaseModel):
    value: float


# ── OrderItem ─────────────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(1, ge=1)
    discount: float = Field(0.0, ge=0, le=100)


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    discount: float
    product: Optional[ProductOut]

    model_config = {"from_attributes": True}


# ── Media & PromoCode ─────────────────────────────────────────────────────────

class PromoCodeCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    discount_percent: float = Field(0.0, ge=0, le=100)
    media_percent: float = Field(0.0, ge=0, le=100)


class PromoCodeUpdate(BaseModel):
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    media_percent: Optional[float] = Field(None, ge=0, le=100)
    is_active: Optional[bool] = None


class PromoCodeOut(BaseModel):
    id: int
    code: str
    discount_percent: float
    media_percent: float
    is_active: bool
    created_at: datetime
    order_count: int = 0
    total_media_earnings: float = 0.0

    model_config = {"from_attributes": True}


class MediaCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class MediaUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


class MediaOut(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    promo_codes: List[PromoCodeOut] = []

    model_config = {"from_attributes": True}


# ── Order ─────────────────────────────────────────────────────────────────────

class OrderCreate(BaseModel):
    external_id: Optional[str] = None
    source: OrderSource = OrderSource.other
    status: Optional[OrderStatus] = None
    items: List[OrderItemCreate] = Field(default_factory=list)
    price: float = Field(..., gt=0)
    original_price: Optional[float] = None
    promo_code: Optional[str] = None
    notes: Optional[str] = None
    client_info: Optional[str] = None
    client_url: Optional[str] = None
    telegram_user_id: Optional[int] = None
    telegram_username: Optional[str] = None


class OrderUpdate(BaseModel):
    external_id: Optional[str] = None
    source: Optional[OrderSource] = None
    notes: Optional[str] = None
    client_info: Optional[str] = None
    client_url: Optional[str] = None
    price: Optional[float] = None
    items: Optional[List[OrderItemCreate]] = None


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class OrderTgNotifyUpdate(BaseModel):
    tg_notify_message_id: Optional[int] = None
    tg_notify_sent_at: Optional[datetime] = None
    tg_notified: Optional[bool] = None
    tg_last_notified_status: Optional[str] = None
    tg_expiry_warned: Optional[bool] = None
    tg_payment_message_id: Optional[int] = None


class OrderOut(BaseModel):
    id: int
    external_id: Optional[str]
    source: OrderSource
    items: List[OrderItemOut]
    status: OrderStatus
    worker_id: Optional[int]
    worker: Optional[UserOut]
    promo_code_id: Optional[int]
    promo_code: Optional[PromoCodeOut]
    original_price: Optional[float]
    price: float
    media_earnings: Optional[float]
    worker_earnings: Optional[float]
    notes: Optional[str]
    client_info: Optional[str]
    client_url: Optional[str]
    telegram_user_id: Optional[int]
    telegram_username: Optional[str]
    tg_notify_message_id: Optional[int]
    tg_notify_sent_at: Optional[datetime]
    tg_notified: bool = False
    tg_last_notified_status: Optional[str]
    tg_expiry_warned: bool
    created_at: datetime
    taken_at: Optional[datetime]
    completed_at: Optional[datetime]
    confirmed_at: Optional[datetime]

    model_config = {"from_attributes": True}


# ── Chat (order) ──────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1)


class MessageOut(BaseModel):
    id: int
    order_id: int
    sender_id: int
    sender: Optional[UserOut]
    content: str
    image_url: Optional[str]
    created_at: datetime
    is_read: bool = False

    model_config = {"from_attributes": True}


# ── Global Chat ───────────────────────────────────────────────────────────────

class GlobalMessageOut(BaseModel):
    id: int
    sender_id: int
    sender: Optional[UserOut]
    content: str
    image_url: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Financial ─────────────────────────────────────────────────────────────────

class TransactionOut(BaseModel):
    id: int
    order_id: int
    order: Optional[OrderOut]
    worker_id: int
    worker: Optional[UserOut]
    amount: float
    status: TransactionStatus
    created_at: datetime
    paid_at: Optional[datetime]

    model_config = {"from_attributes": True}


class FAQCreate(BaseModel):
    question: str = Field(..., min_length=1, max_length=512)
    answer: str = Field(..., min_length=1)
    order: int = 0
    is_active: bool = True


class FAQUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None
    order: Optional[int] = None
    is_active: Optional[bool] = None


class FAQOut(BaseModel):
    id: int
    question: str
    answer: str
    order: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=256)
    slug: str = Field(..., min_length=1, max_length=256)
    excerpt: Optional[str] = None
    content: str = Field(..., min_length=1)
    cover_image_url: Optional[str] = None
    is_published: bool = False


class PostUpdate(BaseModel):
    title: Optional[str] = None
    slug: Optional[str] = None
    excerpt: Optional[str] = None
    content: Optional[str] = None
    cover_image_url: Optional[str] = None
    is_published: Optional[bool] = None


class PostOut(BaseModel):
    id: int
    title: str
    slug: str
    excerpt: Optional[str]
    content: str
    cover_image_url: Optional[str]
    is_published: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BlogCommentCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    parent_id: Optional[int] = None


class BlogCommentOut(BaseModel):
    id: int
    post_id: int
    user_id: int
    parent_id: Optional[int] = None
    text: str
    is_approved: bool
    created_at: datetime
    author_name: Optional[str] = None
    author_photo: Optional[str] = None
    replies: List["BlogCommentOut"] = []

    model_config = {"from_attributes": True}


class BlogSocialOut(BaseModel):
    views: int
    likes: int
    liked_by_me: bool
    comments: List["BlogCommentOut"]


class DashboardStats(BaseModel):
    total_revenue: float
    avg_order_value: float
    total_orders: int
    orders_by_status: dict
    orders_by_source: dict
    worker_earnings_pending: float
    worker_earnings_paid: float
    media_total: float
    owner1_profit: float
    owner2_profit: float
    top_products: List[dict]
    revenue_by_day: List[dict]
    workers_stats: List[dict]


TokenResponse.model_rebuild()
