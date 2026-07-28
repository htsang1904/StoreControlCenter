"""add qc criterion severity

Revision ID: b4e6c8d2f901
Revises: a1c3d5e7f9b2
Create Date: 2026-07-28 09:35:00.000000
"""
from typing import Sequence, Union

from alembic import op

revision: str = "b4e6c8d2f901"
down_revision: Union[str, None] = "a1c3d5e7f9b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute(
        "ALTER TABLE qc_criteria "
        "ADD COLUMN IF NOT EXISTS default_severity VARCHAR(50) NOT NULL DEFAULT 'normal'"
    )
    op.execute(
        "ALTER TABLE qc_session_items "
        "ADD COLUMN IF NOT EXISTS severity_snapshot VARCHAR(50) NOT NULL DEFAULT 'normal'"
    )

def downgrade() -> None:
    op.drop_column("qc_session_items", "severity_snapshot")
    op.drop_column("qc_criteria", "default_severity")
