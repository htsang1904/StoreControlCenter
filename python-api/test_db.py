import asyncio
from app.db.database import SessionLocal
from app.models.ticket import Ticket
from sqlalchemy import select
from app.core.datetime_utils import parse_datetime_to_utc_naive

async def main():
    date_from_dt = parse_datetime_to_utc_naive('2026-04-03').replace(hour=0, minute=0, second=0, microsecond=0)
    date_to_dt = parse_datetime_to_utc_naive('2026-04-09').replace(hour=23, minute=59, second=59, microsecond=999999)

    async with SessionLocal() as session:
        res1 = await session.execute(select(Ticket.id, Ticket.title, Ticket.created_at).order_by(Ticket.id.desc()).limit(5))
        all_tks = res1.all()
        print('Latest tickets in DB:')
        for t in all_tks:
            print(' ', t)

        res2 = await session.execute(
            select(Ticket.id, Ticket.title, Ticket.created_at)
            .where(Ticket.created_at >= date_from_dt)
            .where(Ticket.created_at <= date_to_dt)
        )
        filtered = res2.all()
        print('\nFiltered tickets:')
        for t in filtered:
            print(' ', t)

asyncio.run(main())
