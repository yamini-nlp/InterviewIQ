from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user
from app.database import get_db
from pydantic import BaseModel
from typing import List
import datetime

router = APIRouter(prefix="/api/integrity", tags=["integrity"])


class IntegrityEvent(BaseModel):
    session_id: str
    event_type: str
    timestamp: float
    count: int
    metadata: dict = {}


class IntegrityBatch(BaseModel):
    events: List[IntegrityEvent]


@router.post("/events")
async def log_events(batch: IntegrityBatch, current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is not None:
        docs = [
            {
                "session_id": e.session_id,
                "user_id": current_user["id"],
                "event_type": e.event_type,
                "timestamp": e.timestamp,
                "count": e.count,
                "metadata": e.metadata,
                "logged_at": datetime.datetime.utcnow().isoformat(),
            }
            for e in batch.events
        ]
        await db.integrity_events.insert_many(docs)
        await db.sessions.update_one(
            {"id": batch.events[0].session_id, "user_id": current_user["id"]},
            {"$push": {"integrity_events": {"$each": [e.model_dump() for e in batch.events]}}}
        )
    return {"logged": len(batch.events)}