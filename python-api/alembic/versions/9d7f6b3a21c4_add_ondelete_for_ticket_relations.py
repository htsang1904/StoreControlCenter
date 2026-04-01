"""add_ondelete_for_ticket_relations

Revision ID: 9d7f6b3a21c4
Revises: 4c748349a71b
Create Date: 2026-03-25 14:15:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "9d7f6b3a21c4"
down_revision: Union[str, Sequence[str], None] = "4c748349a71b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(op.f("notifications_ticket_id_fkey"), "notifications", type_="foreignkey")
    op.create_foreign_key(
        op.f("notifications_ticket_id_fkey"),
        "notifications",
        "tickets",
        ["ticket_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.drop_constraint(op.f("ticket_logs_ticket_id_fkey"), "ticket_logs", type_="foreignkey")
    op.create_foreign_key(
        op.f("ticket_logs_ticket_id_fkey"),
        "ticket_logs",
        "tickets",
        ["ticket_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint(op.f("ticket_assignees_ticket_id_fkey"), "ticket_assignees", type_="foreignkey")
    op.create_foreign_key(
        op.f("ticket_assignees_ticket_id_fkey"),
        "ticket_assignees",
        "tickets",
        ["ticket_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("ticket_assignees_ticket_id_fkey"), "ticket_assignees", type_="foreignkey")
    op.create_foreign_key(
        op.f("ticket_assignees_ticket_id_fkey"),
        "ticket_assignees",
        "tickets",
        ["ticket_id"],
        ["id"],
    )

    op.drop_constraint(op.f("ticket_logs_ticket_id_fkey"), "ticket_logs", type_="foreignkey")
    op.create_foreign_key(
        op.f("ticket_logs_ticket_id_fkey"),
        "ticket_logs",
        "tickets",
        ["ticket_id"],
        ["id"],
    )

    op.drop_constraint(op.f("notifications_ticket_id_fkey"), "notifications", type_="foreignkey")
    op.create_foreign_key(
        op.f("notifications_ticket_id_fkey"),
        "notifications",
        "tickets",
        ["ticket_id"],
        ["id"],
    )
