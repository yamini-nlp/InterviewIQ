from typing import List, Optional, Dict
from app.services.mlim.asl import compute_asl
from app.services.mlim.pel import compute_pel
from app.services.mlim.gstl import compute_gstl
from app.services.mlim.ifl import compute_ifl
from app.models.mlim import (
    ASLOutput, PELOutput, GSTLOutput, IFLOutput, MLIMAnalysis,
    GoalState, InteractionEntry,
)


async def run_asl(
    utterance: str,
    face_snapshot: Optional[dict] = None,
    voice_features: Optional[dict] = None,
) -> ASLOutput:
    return await compute_asl(utterance, face_snapshot, voice_features)


async def run_pel(utterance: str, context: List[str], asl: ASLOutput) -> PELOutput:
    return await compute_pel(utterance, context, asl)


async def run_gstl(
    utterance: str,
    job_role: str,
    question_text: str,
    prior_goal_state: Optional[GoalState],
    interaction_history: List[InteractionEntry],
    asl: ASLOutput,
    pel: PELOutput,
    belief_history: Optional[List[Dict[str, float]]] = None,
) -> GSTLOutput:
    return await compute_gstl(
        utterance=utterance,
        job_role=job_role,
        question_text=question_text,
        prior_goal_state=prior_goal_state,
        interaction_history=interaction_history,
        asl=asl,
        pel=pel,
        belief_history=belief_history,
    )


async def run_ifl(
    asl: ASLOutput,
    pel: PELOutput,
    gstl: GSTLOutput,
    utterance: str,
    question_text: str,
    job_role: str,
    longitudinal_history: List[InteractionEntry],
) -> IFLOutput:
    return await compute_ifl(
        asl=asl,
        pel=pel,
        gstl=gstl,
        utterance=utterance,
        question_text=question_text,
        job_role=job_role,
        longitudinal_history=longitudinal_history,
    )


async def run_mlim_pipeline(
    utterance: str,
    question_text: str,
    job_role: str,
    session_id: str,
    context_utterances: List[str],
    interaction_history: List[InteractionEntry],
    prior_goal_state: Optional[GoalState],
    face_snapshot: Optional[dict] = None,
    voice_features: Optional[dict] = None,
    belief_history: Optional[List[Dict[str, float]]] = None,
) -> MLIMAnalysis:
    asl = await run_asl(utterance, face_snapshot, voice_features)
    pel = await run_pel(utterance, context_utterances, asl)

    gstl = await run_gstl(
        utterance=utterance,
        job_role=job_role,
        question_text=question_text,
        prior_goal_state=prior_goal_state,
        interaction_history=interaction_history,
        asl=asl,
        pel=pel,
        belief_history=belief_history,
    )

    ifl = await run_ifl(
        asl=asl,
        pel=pel,
        gstl=gstl,
        utterance=utterance,
        question_text=question_text,
        job_role=job_role,
        longitudinal_history=interaction_history,
    )

    return MLIMAnalysis(
        session_id=session_id,
        question_text=question_text,
        utterance=utterance,
        asl=asl,
        pel=pel,
        gstl=gstl,
        ifl=ifl,
        face_snapshot=face_snapshot,
        voice_features=voice_features,
    )