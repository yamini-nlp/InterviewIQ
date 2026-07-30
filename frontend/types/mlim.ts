export type SpeechActType =
  | "directive"
  | "expressive"
  | "commissive"
  | "representative"
  | "declarative";

export interface SpeechActRoleScore {
  act: SpeechActType;
  confidence: number;
}

export type IntentLabel =
  | "genuine_answer"
  | "face_saving_assertion"
  | "request_for_challenge"
  | "expressing_confusion"
  | "sarcastic_response"
  | "seeking_validation"
  | "committed_retry"
  | "off_topic";

export type FailureModeDetected =
  | "none"
  | "topic_drift"
  | "unresolved_sarcasm_ambiguity"
  | "goal_intent_mismatch"
  | "high_ambiguity";

export type HiringReadinessSignal =
  | "strong_yes"
  | "lean_yes"
  | "neutral"
  | "lean_no"
  | "strong_no";

export interface ASLOutput {
  sentiment: "positive" | "negative" | "neutral";
  sentiment_confidence: number;
  valence: number;
  arousal: number;
  uncertainty_s: number;
  affective_masking_detected: boolean;
  masking_reason: string | null;
  lexicon_sentiment: string;
  lexicon_confidence: number;
  lexicon_llm_disagreement: boolean;
}

export interface PELOutput {
  primary_speech_act: string;
  speech_act_confidence: number;
  secondary_speech_acts: string[];
  concurrent_speech_acts: SpeechActRoleScore[];
  is_interrogative: boolean;
  sarcasm_detected: boolean;
  pragmatic_inversion: boolean;
  is_requesting_challenge: boolean;
  is_expressing_frustration: boolean;
  is_signaling_confusion: boolean;
  is_face_saving: boolean;
  is_seeking_validation: boolean;
  is_committing_to_retry: boolean;
  maxim_violations: Record<string, boolean>;
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
  hiring_readiness_signal: HiringReadinessSignal | null;
  belief_update_trace: Record<string, unknown>;
  goal_drift_kl_divergence: number;
}

export interface FeatureAttribution {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
}

export interface IFLOutput {
  intent_label: string;
  intent_confidence: number;
  intent_distribution: Record<string, number>;
  raw_intent_distribution: Record<string, number>;
  feature_vector: Record<string, number>;
  entropy: number;
  should_solicit_clarification: boolean;
  clarification_prompt: string | null;
  intent_aware_response_modifier: string;
  failure_mode_detected: FailureModeDetected;
  failure_mode_explanation: string | null;
  attributions: FeatureAttribution[];
  counterfactual: string;
}

export interface MLIMAnalysis {
  id: string;
  session_id: string;
  question_text: string;
  utterance: string;
  asl: ASLOutput;
  pel: PELOutput;
  gstl: GSTLOutput;
  ifl: IFLOutput;
  face_snapshot: Record<string, unknown> | null;
  voice_features: Record<string, unknown> | null;
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
  hiring_readiness_signal: HiringReadinessSignal | null;
  belief_update_trace: Record<string, unknown>;
  goal_drift_kl_divergence: number;
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
  average_stress: number;
  average_engagement: number;
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
  face_snapshot: Record<string, unknown> | null;
  voice_features: Record<string, unknown> | null;
}