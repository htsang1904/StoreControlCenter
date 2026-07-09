"""add timestamp defaults to tickets

Revision ID: 9c1f0a2b7d33
Revises: 8b6e2a4c9d11
Create Date: 2026-07-09 03:35:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9c1f0a2b7d33"
down_revision: Union[str, None] = "8b6e2a4c9d11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE tickets SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE tickets SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("tickets", "created_at", server_default=sa.text("now()"))
    op.alter_column("tickets", "updated_at", server_default=sa.text("now()"))


def downgrade() -> None:
    op.alter_column("tickets", "updated_at", server_default=None)
    op.alter_column("tickets", "created_at", server_default=None)
