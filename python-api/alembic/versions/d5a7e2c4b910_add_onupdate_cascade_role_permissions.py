"""add onupdate cascade to role permissions

Revision ID: d5a7e2c4b910
Revises: b3d8f4a6c921
Create Date: 2026-07-10 14:40:00.000000
"""
from typing import Sequence, Union

from alembic import op


revision: str = "d5a7e2c4b910"
down_revision: Union[str, None] = "b3d8f4a6c921"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("role_permissions_permission_code_fkey", "role_permissions", type_="foreignkey")
    op.create_foreign_key(
        "role_permissions_permission_code_fkey",
        "role_permissions",
        "permissions",
        ["permission_code"],
        ["code"],
        ondelete="CASCADE",
        onupdate="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("role_permissions_permission_code_fkey", "role_permissions", type_="foreignkey")
    op.create_foreign_key(
        "role_permissions_permission_code_fkey",
        "role_permissions",
        "permissions",
        ["permission_code"],
        ["code"],
        ondelete="CASCADE",
    )
