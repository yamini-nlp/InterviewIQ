from fastapi import APIRouter, HTTPException, Depends
from app.models.question import EvaluateAnswerRequest
from app.services.evaluation_service import evaluate_answer
from app.models.session import Answer
from app.database import get_db
from app.auth.dependencies import get_current_user

router = APIRouter(prefix="/api/evaluate", tags=["evaluate"])


@router.post("/answer")
async def evaluate(request: EvaluateAnswerRequest, current_user: dict = Depends(get_current_user)):
    try:
        feedback = await evaluate_answer(
            request.question_id,
            request.question_text,
            request.question_category,
            request.question_difficulty,
            request.answer_text,
            request.job_role,
        )
        answer = Answer(question_id=request.question_id, text=request.answer_text)

        try:
            db = get_db()
            if db is not None:
                session = await db.sessions.find_one({"id": request.session_id})
                if session and session.get("user_id") != current_user["id"]:
                    raise HTTPException(status_code=403, detail="Access denied")
                await db.sessions.update_one(
                    {"id": request.session_id},
                    {"$push": {"answers": answer.model_dump(), "feedbacks": feedback.model_dump()}},
                )
        except HTTPException:
            raise
        except Exception as db_error:
            print(f"DB save skipped: {db_error}")

        return feedback.model_dump()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))