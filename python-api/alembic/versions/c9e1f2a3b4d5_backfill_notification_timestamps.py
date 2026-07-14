"""Backfill notification timestamps

Revision ID: c9e1f2a3b4d5
Revises: b8f4c2d9e7a1
Create Date: 2026-07-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c9e1f2a3b4d5"
down_revision: Union[str, Sequence[str], None] = "b8f4c2d9e7a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE notifications SET created_at = now() WHERE created_at IS NULL")
    op.execute("UPDATE notifications SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column(
        "notifications",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        existing_nullable=True,
    )
    op.alter_column(
        "notifications",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text("now()"),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "notifications",
        "updated_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        existing_nullable=True,
    )
    op.alter_column(
        "notifications",
        "created_at",
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        existing_nullable=True,
    )
