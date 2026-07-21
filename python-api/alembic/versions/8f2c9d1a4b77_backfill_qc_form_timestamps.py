"""backfill qc form timestamps

Revision ID: 8f2c9d1a4b77
Revises: 0f3a7b9d2c41
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "8f2c9d1a4b77"
down_revision: Union[str, Sequence[str], None] = "0f3a7b9d2c41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE qc_forms SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE qc_forms SET updated_at = created_at WHERE updated_at IS NULL")
    op.execute("UPDATE qc_form_versions SET created_at = NOW() WHERE created_at IS NULL")
    op.execute("UPDATE qc_form_versions SET updated_at = created_at WHERE updated_at IS NULL")

    op.alter_column("qc_forms", "created_at", server_default=sa.text("now()"))
    op.alter_column("qc_forms", "updated_at", server_default=sa.text("now()"))
    op.alter_column("qc_form_versions", "created_at", server_default=sa.text("now()"))
    op.alter_column("qc_form_versions", "updated_at", server_default=sa.text("now()"))


def downgrade() -> None:
    op.alter_column("qc_form_versions", "updated_at", server_default=None)
    op.alter_column("qc_form_versions", "created_at", server_default=None)
    op.alter_column("qc_forms", "updated_at", server_default=None)
    op.alter_column("qc_forms", "created_at", server_default=None)
