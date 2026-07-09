"""add min_pass_score_snapshot to qc_session_items

Revision ID: 7a4d9c2e1f0b
Revises: 2f7c1d9a8b3e
Create Date: 2026-07-09 03:18:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "7a4d9c2e1f0b"
down_revision: Union[str, None] = "2f7c1d9a8b3e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE qc_session_items "
        "ADD COLUMN IF NOT EXISTS min_pass_score_snapshot NUMERIC(10, 2) DEFAULT 0"
    )
    op.alter_column("qc_session_items", "min_pass_score_snapshot", server_default=None)


def downgrade() -> None:
    op.drop_column("qc_session_items", "min_pass_score_snapshot")
