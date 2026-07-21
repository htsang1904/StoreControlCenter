"""merge QC and notification migration heads

Revision ID: 0f3a7b9d2c41
Revises: 6d4a2f8c1b90, c9e1f2a3b4d5
"""
from typing import Sequence, Union

revision: str = "0f3a7b9d2c41"
down_revision: Union[str, Sequence[str], None] = ("6d4a2f8c1b90", "c9e1f2a3b4d5")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
