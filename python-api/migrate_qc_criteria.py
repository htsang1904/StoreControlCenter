import asyncio
import logging
from app.db.database import get_db, async_engine
from sqlalchemy import text

async def run_migration():
    async with async_engine.connect() as conn:
        try:
            await conn.execute(text("ALTER TABLE qc_criteria ADD COLUMN default_min_pass_score NUMERIC(10, 2) DEFAULT 0;"))
            await conn.commit()
            print("Successfully added default_min_pass_score column.")
        except Exception as e:
            print(f"Migration error (might already exist): {e}")

if __name__ == "__main__":
    asyncio.run(run_migration())
