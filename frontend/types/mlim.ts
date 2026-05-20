export interface ASLOutput {
    sentiment: "positive" | "negative" | "neutral";
    sentiment_confidence: number;
    valence: number;
    arousal: number;
    uncertainty_s: number;
    affective_masking_detected: boolean;
    masking_reason: string | null;
  }
  
  export interface PELOutput {
    primary_speech_act: string;
    speech_act_confidence: number;
    secondary_speech_acts: string[];
    sarcasm_detected: boolean;
    pragmatic_inversion: boolean;
    is_requesting_challenge: boolean;
    is_expressing_frustration: boolean;
    is_signaling_confusion: boolean;
    is_face_saving: boolean;
    is_seeking_validation: boolean;
    is_committing_to_retry: boolean;
    gricean_implicature: string;
    pragmatic_context_label: string;
  }
  
  export interface GSTLOutput {
    dominant_goal: string;
    goal_belief_distribution: Record<string, number>;
    confidence_level: number;
    goal_drift_detected: boolean;
    session_trajectory: "improving" | "declining" | "stable" | "volatile" | "insufficient_data";
    engagement_level: number;
    stress_indicators: number;
    readiness_estimate: number;
    recommended_system_action: string;
  }
  
  export interface IFLOutput {
    intent_label: string;
    intent_confidence: number;
    intent_distribution: Record<string, number>;
    entropy: number;
    should_solicit_clarification: boolean;
    clarification_prompt: string | null;
    intent_aware_response_modifier: string;
    failure_mode_detected: "none" | "affective_masking" | "pragmatic_inversion" | "temporal_goal_drift" | "role_ambiguity";
    failure_mode_explanation: string | null;
  }
  
  export interface MLIMAnalysis {
    session_id: string;
    question_text: string;
    utterance: string;
    asl: ASLOutput;
    pel: PELOutput;
    gstl: GSTLOutput;
    ifl: IFLOutput;
    timestamp: string;
  }
  
  export interface InteractionEntry {
    question: string;
    answer: string;
    score: number;
    intent_label?: string;
    timestamp?: string;
  }
  
  export interface GoalState {
    dominant_goal: string;
    goal_belief_distribution: Record<string, number>;
    confidence_level: number;
    goal_drift_detected: boolean;
    session_trajectory: string;
    engagement_level: number;
    stress_indicators: number;
    readiness_estimate: number;
    recommended_system_action: string;
  }
  
  export interface MLIMSessionSummary {
    session_id: string;
    total_analyses: number;
    dominant_intent_distribution: Record<string, number>;
    failure_modes_detected: string[];
    average_entropy: number;
    session_trajectory: string;
    readiness_estimate: number;
    goal_drift_count: number;
    affective_masking_count: number;
    sarcasm_count: number;
    recommended_actions: string[];
  }
  
  export interface MLIMAnalyzeRequest {
    session_id: string;
    question_id: string;
    question_text: string;
    answer_text: string;
    job_role: string;
    context_utterances: string[];
    interaction_history: InteractionEntry[];
    prior_goal_state: GoalState | null;
  }