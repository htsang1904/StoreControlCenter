"""add timestamp defaults to ticket_logs

Revision ID: 8b6e2a4c9d11
Revises: 7a4d9c2e1f0b
Create Date: 2026-07-09 03:28:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "8b6e2a4c9d11"
down_revision: Union[str, None] = "7a4d9c2e1f0b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE ticket_logs SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE ticket_logs SET updated_at = created_at WHERE updated_at IS NULL")
    op.alter_column("ticket_logs", "created_at", server_default=sa.text("now()"))
    op.alter_column("ticket_logs", "updated_at", server_default=sa.text("now()"))


def downgrade() -> None:
    op.alter_column("ticket_logs", "updated_at", server_default=None)
    op.alter_column("ticket_logs", "created_at", server_default=None)
