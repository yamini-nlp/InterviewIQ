from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user
from app.database import get_db
from app.core import metrics
from pydantic import BaseModel
from typing import List, Dict
from collections import defaultdict
import datetime
import logging

logger = logging.getLogger(__name__)

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
    if not batch.events:
        return {"logged": 0}

    db = get_db()
    if db is not None:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        docs = [
            {
                "session_id": e.session_id,
                "user_id": current_user["id"],
                "event_type": e.event_type,
                "timestamp": e.timestamp,
                "count": e.count,
                "metadata": e.metadata,
                "logged_at": now,
            }
            for e in batch.events
        ]
        try:
            await db.integrity_events.insert_many(docs)

            events_by_session: Dict[str, list] = defaultdict(list)
            for e in batch.events:
                events_by_session[e.session_id].append(e.model_dump())

            for session_id, events in events_by_session.items():
                await db.sessions.update_one(
                    {"id": session_id, "user_id": current_user["id"]},
                    {"$push": {"integrity_events": {"$each": events}}},
                )
        except Exception as db_error:
            metrics.record_mongo_error(operation="integrity_events_insert")
            logger.warning(f"Integrity event persistence failed: {db_error}")

    return {"logged": len(batch.events)}