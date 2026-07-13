"""identify users by suite staff id

Revision ID: f4a1b2c3d4e5
Revises: e6f1a9c8d204
Create Date: 2026-07-13 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f4a1b2c3d4e5'
down_revision: Union[str, Sequence[str], None] = 'e6f1a9c8d204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('suite_staff_id', sa.String(length=64), nullable=True))
    op.execute("UPDATE users SET suite_staff_id = substring(suite_token from 7) WHERE suite_token LIKE 'staff:%'")
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=False)
    op.create_index(op.f('ix_users_suite_staff_id'), 'users', ['suite_staff_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_suite_staff_id'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.drop_column('users', 'suite_staff_id')
