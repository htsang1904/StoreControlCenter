"""add default_min_pass_score to qc_criteria

Revision ID: 2f7c1d9a8b3e
Revises: 9d7f6b3a21c4
Create Date: 2026-07-09 03:12:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "2f7c1d9a8b3e"
down_revision: Union[str, None] = "9d7f6b3a21c4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE qc_criteria "
        "ADD COLUMN IF NOT EXISTS default_min_pass_score NUMERIC(10, 2) DEFAULT 0"
    )
    op.alter_column("qc_criteria", "default_min_pass_score", server_default=None)


def downgrade() -> None:
    op.drop_column("qc_criteria", "default_min_pass_score")
