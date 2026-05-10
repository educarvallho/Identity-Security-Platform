"""Add risk_rules table

Revision ID: 002
Revises: 001
Create Date: 2026-04-28

"""
from typing import Sequence, Union
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "risk_rules",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("rain_prob_high", sa.Float, nullable=False, server_default="70"),
        sa.Column("rain_prob_medium", sa.Float, nullable=False, server_default="40"),
        sa.Column("wind_high", sa.Float, nullable=False, server_default="50"),
        sa.Column("wind_medium", sa.Float, nullable=False, server_default="30"),
        sa.Column("temp_extreme_high", sa.Float, nullable=False, server_default="33"),
        sa.Column("temp_extreme_low", sa.Float, nullable=False, server_default="5"),
        sa.Column("temp_high", sa.Float, nullable=False, server_default="28"),
        sa.Column("temp_low", sa.Float, nullable=False, server_default="10"),
        sa.Column("rain_volume_high", sa.Float, nullable=False, server_default="20"),
        sa.Column("score_high_threshold", sa.Integer, nullable=False, server_default="5"),
        sa.Column("score_medium_threshold", sa.Integer, nullable=False, server_default="3"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("risk_rules")
