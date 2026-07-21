"""add deduction percent to qc criteria

Revision ID: 6d4a2f8c1b90
Revises: 7a4d9c2e1f0b
"""
from typing import Sequence, Union
from alembic import op

revision: str = "6d4a2f8c1b90"
down_revision: Union[str, None] = "7a4d9c2e1f0b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("ALTER TABLE qc_criteria ADD COLUMN IF NOT EXISTS default_deduction_percent NUMERIC(10, 2) DEFAULT 0")
    op.alter_column("qc_criteria", "default_deduction_percent", server_default=None)

def downgrade() -> None:
    op.drop_column("qc_criteria", "default_deduction_percent")
