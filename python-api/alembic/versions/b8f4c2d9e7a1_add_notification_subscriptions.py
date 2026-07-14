"""Add notification subscriptions

Revision ID: b8f4c2d9e7a1
Revises: a7b8c9d0e1f2
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b8f4c2d9e7a1"
down_revision: Union[str, Sequence[str], None] = "a7b8c9d0e1f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "notification_subscriptions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.String(length=255), nullable=False),
        sa.Column("external_id", sa.String(length=255), nullable=True),
        sa.Column("platform", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("subscription_id", name="uq_notification_subscriptions_subscription_id"),
    )
    op.create_index(op.f("ix_notification_subscriptions_id"), "notification_subscriptions", ["id"], unique=False)
    op.create_index(op.f("ix_notification_subscriptions_user_id"), "notification_subscriptions", ["user_id"], unique=False)
    op.create_index(op.f("ix_notification_subscriptions_subscription_id"), "notification_subscriptions", ["subscription_id"], unique=False)
    op.create_index(op.f("ix_notification_subscriptions_external_id"), "notification_subscriptions", ["external_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notification_subscriptions_external_id"), table_name="notification_subscriptions")
    op.drop_index(op.f("ix_notification_subscriptions_subscription_id"), table_name="notification_subscriptions")
    op.drop_index(op.f("ix_notification_subscriptions_user_id"), table_name="notification_subscriptions")
    op.drop_index(op.f("ix_notification_subscriptions_id"), table_name="notification_subscriptions")
    op.drop_table("notification_subscriptions")
