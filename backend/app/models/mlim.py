from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum
import math


class SpeechActType(str, Enum):
    directive = "directive"
    expressive = "expressive"
    commissive = "commissive"
    representative = "representative"
    declarative = "declarative"
    interrogative = "interrogative"


class IntentLabel(str, Enum):
    genuine_answer = "genuine_answer"
    face_saving_assertion = "face_saving_assertion"
    request_for_challenge = "request_for_challenge"
    expressing_confusion = "expressing_confusion"
    sarcastic_response = "sarcastic_response"
    seeking_validation = "seeking_validation"
    committed_retry = "committed_retry"
    off_topic = "off_topic"


class ASLOutput(BaseModel):
    sentiment: str
    sentiment_confidence: float
    valence: float
    arousal: float
    uncertainty_s: float
    affective_masking_detected: bool
    masking_reason: Optional[str] = None


class PELOutput(BaseModel):
    primary_speech_act: str
    speech_act_confidence: float
    secondary_speech_acts: List[str] = []
    sarcasm_detected: bool
    pragmatic_inversion: bool
    is_requesting_challenge: bool
    is_expressing_frustration: bool
    is_signaling_confusion: bool
    is_face_saving: bool
    is_seeking_validation: bool
    is_committing_to_retry: bool
    gricean_implicature: str
    pragmatic_context_label: str


class GSTLOutput(BaseModel):
    dominant_goal: str
    goal_belief_distribution: Dict[str, float]
    confidence_level: float
    goal_drift_detected: bool
    session_trajectory: str
    engagement_level: float
    stress_indicators: float
    readiness_estimate: float
    recommended_system_action: str
    hiring_readiness_signal: Optional[str] = None


class IFLOutput(BaseModel):
    intent_label: str
    intent_confidence: float
    intent_distribution: Dict[str, float]
    entropy: float
    should_solicit_clarification: bool
    clarification_prompt: Optional[str] = None
    intent_aware_response_modifier: str
    failure_mode_detected: str
    failure_mode_explanation: Optional[str] = None


class MLIMAnalysis(BaseModel):
    session_id: str
    question_text: str
    utterance: str
    asl: ASLOutput
    pel: PELOutput
    gstl: GSTLOutput
    ifl: IFLOutput
    face_snapshot: Optional[Dict[str, Any]] = None
    voice_features: Optional[Dict[str, Any]] = None
    timestamp: Optional[datetime] = None

    def model_post_init(self, __context):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()


class GoalState(BaseModel):
    dominant_goal: str
    goal_belief_distribution: Dict[str, float]
    confidence_level: float
    goal_drift_detected: bool
    session_trajectory: str
    engagement_level: float
    stress_indicators: float
    readiness_estimate: float
    recommended_system_action: str
    hiring_readiness_signal: Optional[str] = None


class InteractionEntry(BaseModel):
    question: str
    answer: str
    score: int
    intent_label: Optional[str] = None
    timestamp: Optional[datetime] = None


class MLIMAnalyzeRequest(BaseModel):
    session_id: str
    question_id: str
    question_text: str
    answer_text: str
    job_role: str
    context_utterances: List[str] = []
    interaction_history: List[InteractionEntry] = []
    prior_goal_state: Optional[GoalState] = None
    face_snapshot: Optional[Dict[str, Any]] = None
    voice_features: Optional[Dict[str, Any]] = None


class MLIMSessionSummary(BaseModel):
    session_id: str
    total_analyses: int
    dominant_intent_distribution: Dict[str, float]
    failure_modes_detected: List[str]
    average_entropy: float
    session_trajectory: str
    readiness_estimate: float
    goal_drift_count: int
    affective_masking_count: int
    sarcasm_count: int
    recommended_actions: List[str]
    average_stress: float = 0.0
    average_engagement: float = 0.0