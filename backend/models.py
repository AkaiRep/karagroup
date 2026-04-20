from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean,
    DateTime, ForeignKey, Enum as SAEnum, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship, backref
from database import Base
import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    worker = "worker"
    client = "client"


class OrderSource(str, enum.Enum):
    funpay = "funpay"
    telegram = "telegram"
    website = "website"
    other = "other"


class OrderStatus(str, enum.Enum):
    pending_payment = "pending_payment"
    paid = "paid"
    in_progress = "in_progress"
    completed = "completed"
    confirmed = "confirmed"


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=True)
    password_hash = Column(String(256), nullable=False)
    role = Column(SAEnum(UserRole), default=UserRole.worker, nullable=False)
    worker_percentage = Column(Float, default=70.0)
    is_vip = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True)
    telegram_id = Column(Integer, nullable=True, unique=True, index=True)
    telegram_username = Column(String(128), nullable=True)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    orders = relationship("Order", back_populates="worker", foreign_keys="Order.worker_id")
    messages = relationship("ChatMessage", back_populates="sender")
    transactions = relationship("Transaction", back_populates="worker")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    price_usd = Column(Float, nullable=True)
    price_eur = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    discount_percent = Column(Float, default=0.0, nullable=False)
    image_url = Column(String(512), nullable=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=True)
    is_clearance = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    category = relationship("Category", back_populates="products")
    order_items = relationship("OrderItem", back_populates="product")
    subregions = relationship("ProductSubregion", back_populates="product", cascade="all, delete-orphan")


class ProductSubregion(Base):
    __tablename__ = "product_subregions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    name = Column(String(256), nullable=False)
    price = Column(Float, nullable=False)
    auto_price = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="subregions")


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    external_id = Column(String(128), nullable=True, index=True)
    source = Column(SAEnum(OrderSource), default=OrderSource.other, nullable=False)
    status = Column(SAEnum(OrderStatus), default=OrderStatus.paid, nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    promo_code_id = Column(Integer, ForeignKey("promo_codes.id"), nullable=True)
    original_price = Column(Float, nullable=True)       # pre-discount price
    price = Column(Float, nullable=False)               # what customer pays (after promo discount)
    media_earnings = Column(Float, nullable=True)       # snapshotted at order creation
    worker_earnings = Column(Float, nullable=True)      # snapshotted at take time
    worker_is_vip = Column(Boolean, nullable=True)      # snapshotted at take time
    notes = Column(Text, nullable=True)
    client_info = Column(String(512), nullable=True)
    client_url = Column(String(2048), nullable=True)
    telegram_user_id = Column(Integer, nullable=True, index=True)
    telegram_username = Column(String(128), nullable=True)
    tg_notify_message_id = Column(Integer, nullable=True)
    tg_notify_sent_at = Column(DateTime, nullable=True)
    tg_payment_message_id = Column(Integer, nullable=True)
    tg_notified = Column(Boolean, default=False, nullable=False)
    tg_last_notified_status = Column(String(32), nullable=True)
    tg_expiry_warned = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    taken_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    confirmed_at = Column(DateTime, nullable=True)

    worker = relationship("User", back_populates="orders", foreign_keys=[worker_id])
    promo_code = relationship("PromoCode", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    messages = relationship("ChatMessage", back_populates="order", cascade="all, delete-orphan")
    transaction = relationship("Transaction", back_populates="order", uselist=False, cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=1, nullable=False)
    discount = Column(Float, default=0.0, nullable=False)  # 0-100 percent

    order = relationship("Order", back_populates="items")
    product = relationship("Product", back_populates="order_items")
    subregions = relationship("OrderSubregion", back_populates="order_item", cascade="all, delete-orphan")


class OrderSubregion(Base):
    __tablename__ = "order_subregions"

    id = Column(Integer, primary_key=True, index=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    subregion_id = Column(Integer, ForeignKey("product_subregions.id"), nullable=True)  # nullable — субрегион мог быть удалён
    name = Column(String(256), nullable=False)   # снапшот названия
    price = Column(Float, nullable=False)          # снапшот цены

    order_item = relationship("OrderItem", back_populates="subregions")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False, default="")
    image_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    order = relationship("Order", back_populates="messages")
    sender = relationship("User", back_populates="messages")


class WorkSession(Base):
    __tablename__ = "work_sessions"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    started_at = Column(DateTime, nullable=False)
    ended_at = Column(DateTime, nullable=True)  # null = still active

    user = relationship("User")


class ChatReadReceipt(Base):
    __tablename__ = "chat_read_receipts"

    id = Column(Integer, primary_key=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    last_read_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("order_id", "user_id", name="uq_chat_receipt"),)


class GlobalChatMessage(Base):
    __tablename__ = "global_chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False, default="")
    image_url = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    sender = relationship("User")


class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    promo_codes = relationship("PromoCode", back_populates="media", cascade="all, delete-orphan")


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id = Column(Integer, primary_key=True, index=True)
    media_id = Column(Integer, ForeignKey("media.id"), nullable=False)
    code = Column(String(64), unique=True, nullable=False, index=True)
    discount_percent = Column(Float, default=0.0, nullable=False)  # discount for customer
    media_percent = Column(Float, default=0.0, nullable=False)      # % media person earns
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    media = relationship("Media", back_populates="promo_codes")
    orders = relationship("Order", back_populates="promo_code")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(64), primary_key=True)
    value = Column(String(256), nullable=False, default="")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    worker_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    status = Column(SAEnum(TransactionStatus), default=TransactionStatus.pending, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    paid_at = Column(DateTime, nullable=True)

    order = relationship("Order", back_populates="transaction")
    worker = relationship("User", back_populates="transactions")


class FAQ(Base):
    __tablename__ = "faqs"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(String(512), nullable=False)
    answer = Column(Text, nullable=False)
    order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(256), nullable=False)
    slug = Column(String(256), unique=True, nullable=False, index=True)
    excerpt = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    cover_image_url = Column(String(512), nullable=True)
    is_published = Column(Boolean, default=False, nullable=False)
    views = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    likes = relationship("BlogLike", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("BlogComment", back_populates="post", cascade="all, delete-orphan")


class BlogLike(Base):
    __tablename__ = "blog_likes"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    post = relationship("Post", back_populates="likes")
    user = relationship("User")


class BlogComment(Base):
    __tablename__ = "blog_comments"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    parent_id = Column(Integer, ForeignKey("blog_comments.id", ondelete="CASCADE"), nullable=True)
    text = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    post = relationship("Post", back_populates="comments")
    user = relationship("User")
    replies = relationship("BlogComment", cascade="all, delete-orphan", backref=backref("parent", remote_side="BlogComment.id"))


class BlogViewLog(Base):
    __tablename__ = "blog_view_log"

    id = Column(Integer, primary_key=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False)
    ip_hash = Column(String(64), nullable=False)
    viewed_date = Column(String(10), nullable=False)  # YYYY-MM-DD


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    author = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    rating = Column(Integer, default=5)
    game = Column(String, nullable=True)
    date_str = Column(String, nullable=True)
    source = Column(String, default="funpay")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class TeleportGroup(Base):
    __tablename__ = "teleport_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(128), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    presets = relationship("TeleportPreset", back_populates="group", cascade="all, delete-orphan")


class TeleportPreset(Base):
    __tablename__ = "teleport_presets"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("teleport_groups.id"), nullable=False)
    name = Column(String(256), nullable=False)
    filename = Column(String(256), nullable=False)  # stored filename on disk
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    group = relationship("TeleportGroup", back_populates="presets")


class TelegramLinkToken(Base):
    __tablename__ = "telegram_link_tokens"

    token = Column(String(64), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)

    user = relationship("User")


class WorkerApplication(Base):
    __tablename__ = "worker_applications"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(256), nullable=False)
    birth_date = Column(String(10), nullable=False)   # YYYY-MM-DD
    phone = Column(String(32), nullable=False)
    telegram_username = Column(String(128), nullable=False)
    consent_data = Column(Boolean, nullable=False, default=False)
    consent_documents = Column(Boolean, nullable=False, default=False)
    status = Column(String(32), nullable=False, default="new")  # new / reviewed / accepted / rejected
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
