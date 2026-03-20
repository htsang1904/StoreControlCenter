import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Table, Enum, func
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.db.types import UTCNaiveDateTime

# Association Table for User <-> Store (Many-to-Many as per Strapi schema `stores` relation)
user_stores = Table(
    'user_stores',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id', ondelete="CASCADE"), primary_key=True),
    Column('store_id', Integer, ForeignKey('stores.id'), primary_key=True)
)


class UserRole(str, enum.Enum):
    admin = "admin"
    store = "store"
    handler = "handler"
    qc = "qc"

from sqlalchemy.types import TypeDecorator

class LowerCaseEnum(TypeDecorator):
    """Ensures database values are lowercased before mapping to Enum."""
    impl = Enum(UserRole, native_enum=False, length=50)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return value.value if hasattr(value, 'value') else str(value).lower()

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return UserRole(value.lower())

class User(Base):
    """
    Unified User model replacing Strapi's split `up_users` and `user_infos` tables.
    Matches the `UserInfo` logic from the Node.js implementation perfectly.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone_number = Column(String(20), nullable=True) # Mới: Lưu số điện thoại từ Suite
    suite_token = Column(Text, nullable=True)
    is_active = Column(Boolean, default=False) # Created as False by default pending admin approval
    
    refresh_token_hash = Column(String(255), nullable=True)
    refresh_token_expires_at = Column(UTCNaiveDateTime(), nullable=True)
    token_version = Column(Integer, default=0)
    
    # Store enum values from Strapi: "store", "handler", "qc", "admin"
    role = Column(LowerCaseEnum, default=UserRole.store, nullable=False)
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    department = relationship("Department", back_populates="users")
    stores = relationship("Store", secondary=user_stores, back_populates="users")
    assigned_tickets = relationship("Ticket", secondary="ticket_assignees", back_populates="assignees")
    notifications = relationship("Notification", foreign_keys="[Notification.recipient_id]", overlaps="recipient")

    def __str__(self):
        return self.name or self.email
