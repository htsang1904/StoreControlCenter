"""pin qc drafts to form versions

Revision ID: a1c3d5e7f9b2
Revises: 8f2c9d1a4b77
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1c3d5e7f9b2"
down_revision: Union[str, Sequence[str], None] = "8f2c9d1a4b77"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("qc_drafts", sa.Column("form_version_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_qc_drafts_form_version_id"), "qc_drafts", ["form_version_id"], unique=False)
    op.create_foreign_key(
        "fk_qc_drafts_form_version_id_qc_form_versions",
        "qc_drafts",
        "qc_form_versions",
        ["form_version_id"],
        ["id"],
    )

    op.execute(
        """
        UPDATE qc_drafts AS draft
        SET form_version_id = active_version.id
        FROM (
            SELECT DISTINCT ON (form_id) id, form_id
            FROM qc_form_versions
            WHERE status = 'published'
            ORDER BY form_id, id DESC
        ) AS active_version
        WHERE draft.form_version_id IS NULL
          AND draft.template_id ~ '^[0-9]+$'
          AND active_version.form_id = draft.template_id::integer
        """
    )


def downgrade() -> None:
    op.drop_constraint("fk_qc_drafts_form_version_id_qc_form_versions", "qc_drafts", type_="foreignkey")
    op.drop_index(op.f("ix_qc_drafts_form_version_id"), table_name="qc_drafts")
    op.drop_column("qc_drafts", "form_version_id")
