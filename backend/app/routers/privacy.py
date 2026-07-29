import json

from fastapi import APIRouter, HTTPException, Depends, Response
from pydantic import BaseModel

from app.auth.dependencies import get_current_user
from app.database import get_db
from app.services.privacy_service import export_user_data, delete_user_data

router = APIRouter(prefix="/api/privacy", tags=["privacy"])


class AccountDeletionRequest(BaseModel):
    confirm: bool = False


@router.get("/export")
async def export_data(current_user: dict = Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    data = await export_user_data(db, current_user["id"])
    content = json.dumps(data, indent=2, default=str)
    return Response(
        content=content,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="user_data_export_{current_user["id"]}.json"'
        },
    )


@router.delete("/account")
async def delete_account(
    req: AccountDeletionRequest, current_user: dict = Depends(get_current_user)
):
    if not req.confirm:
        raise HTTPException(status_code=400, detail="Account deletion requires confirm=true")

    db = get_db()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    counts = await delete_user_data(db, current_user["id"])

    user_delete_result = await db.users.delete_one({"id": current_user["id"]})
    counts["users"] = user_delete_result.deleted_count

    refresh_delete_result = await db.refresh_tokens.delete_many({"user_id": current_user["id"]})
    counts["refresh_tokens"] = refresh_delete_result.deleted_count

    return {"deleted": True, "counts": counts}


@router.get("/policy-summary")
async def policy_summary():
    return {
        "data_collected": {
            "interaction_history": "Question and answer pairs, scores, and intent labels from your practice sessions.",
            "goal_state_beliefs": "Modeled goal-belief distributions, session trajectory, engagement level, and stress indicators derived from your responses.",
            "affective_signals": "Sentiment, valence, arousal, and affective-masking indicators derived from your utterances, plus optional face or voice features if you choose to provide them.",
        },
        "retention_period": "Session records are retained for 90 days from creation and are then automatically deleted, in line with the platform's data minimization policy.",
        "purpose_limitation": "Data collected through the Multi-Layer Intent Modeling (MLIM) system is used exclusively to provide interview coaching feedback and improve the accuracy of intent interpretation for your own sessions. It is not used for unrelated purposes.",
        "user_rights": "You may export a copy of all data associated with your account at any time via GET /api/privacy/export, and may permanently delete your account and all associated data via DELETE /api/privacy/account.",
    }