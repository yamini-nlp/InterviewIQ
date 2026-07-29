import math
import random
import logging
from datetime import datetime
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

USER_ID_COLLECTIONS: List[str] = [
    "sessions",
    "reports",
    "mlim_analyses",
    "mlim_escalations",
    "integrity_events",
]


def _serialize_doc(doc: dict) -> dict:
    serialized: Dict[str, Any] = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        if isinstance(value, datetime):
            serialized[key] = value.isoformat()
        else:
            serialized[key] = value
    return serialized


async def export_user_data(db, user_id: str) -> dict:
    export: Dict[str, Any] = {}

    user_doc = await db.users.find_one({"id": user_id})
    export["users"] = [_serialize_doc(user_doc)] if user_doc else []

    for collection_name in USER_ID_COLLECTIONS:
        cursor = db[collection_name].find({"user_id": user_id})
        docs = await cursor.to_list(length=None)
        export[collection_name] = [_serialize_doc(doc) for doc in docs]

    return export


async def delete_user_data(db, user_id: str) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for collection_name in USER_ID_COLLECTIONS:
        result = await db[collection_name].delete_many({"user_id": user_id})
        counts[collection_name] = result.deleted_count
    return counts


def add_laplace_noise(value: float, sensitivity: float = 1.0, epsilon: float = 1.0) -> float:
    scale = sensitivity / epsilon
    u = random.random() - 0.5
    sign = 1.0 if u >= 0 else -1.0
    magnitude = 1.0 - 2.0 * abs(u)
    if magnitude <= 0.0:
        magnitude = 1e-12
    noise = -scale * sign * math.log(magnitude)
    return value + noise