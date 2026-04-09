import asyncio
from app.db.database import SessionLocal
from app.models.ticket import Ticket
from sqlalchemy import update
from app.core.datetime_utils import utc_now_naive

async def main():
    now = utc_now_naive()
    async with SessionLocal() as session:
        # Patch NULL timestamps
        stmt = update(Ticket).where(Ticket.created_at == None).values(created_at=now, updated_at=now)
        res = await session.execute(stmt)
        await session.commit()
        print(f"Patched {res.rowcount} tickets.")

asyncio.run(main())
