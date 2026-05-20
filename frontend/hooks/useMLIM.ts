"use client";
import { useState, useCallback, useRef } from "react";
import { runMLIMAnalysis } from "@/lib/mlim-api";
import { MLIMAnalysis, InteractionEntry, GoalState, MLIMAnalyzeRequest } from "@/types/mlim";

export interface UseMLIMState {
  latestAnalysis: MLIMAnalysis | null;
  analysisHistory: MLIMAnalysis[];
  isAnalyzing: boolean;
  error: string | null;
  analyze: (params: {
    sessionId: string;
    questionId: string;
    questionText: string;
    answerText: string;
    jobRole: string;
  }) => Promise<MLIMAnalysis | null>;
  clearSession: () => void;
}

export function useMLIM(): UseMLIMState {
  const [latestAnalysis, setLatestAnalysis] = useState<MLIMAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<MLIMAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interactionHistoryRef = useRef<InteractionEntry[]>([]);
  const contextUtterancesRef = useRef<string[]>([]);
  const priorGoalStateRef = useRef<GoalState | null>(null);

  const analyze = useCallback(
    async (params: {
      sessionId: string;
      questionId: string;
      questionText: string;
      answerText: string;
      jobRole: string;
    }): Promise<MLIMAnalysis | null> => {
      setIsAnalyzing(true);
      setError(null);
      try {
        const req: MLIMAnalyzeRequest = {
          session_id: params.sessionId,
          question_id: params.questionId,
          question_text: params.questionText,
          answer_text: params.answerText,
          job_role: params.jobRole,
          context_utterances: contextUtterancesRef.current,
          interaction_history: interactionHistoryRef.current,
          prior_goal_state: priorGoalStateRef.current,
        };

        const result = await runMLIMAnalysis(req);

        contextUtterancesRef.current = [
          ...contextUtterancesRef.current.slice(-4),
          params.answerText,
        ];

        priorGoalStateRef.current = {
          dominant_goal: result.gstl.dominant_goal,
          goal_belief_distribution: result.gstl.goal_belief_distribution,
          confidence_level: result.gstl.confidence_level,
          goal_drift_detected: result.gstl.goal_drift_detected,
          session_trajectory: result.gstl.session_trajectory,
          engagement_level: result.gstl.engagement_level,
          stress_indicators: result.gstl.stress_indicators,
          readiness_estimate: result.gstl.readiness_estimate,
          recommended_system_action: result.gstl.recommended_system_action,
        };

        setLatestAnalysis(result);
        setAnalysisHistory((prev) => [...prev, result]);
        return result;
      } catch (e) {
        setError(e instanceof Error ? e.message : "MLIM analysis failed");
        return null;
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  const clearSession = useCallback(() => {
    setLatestAnalysis(null);
    setAnalysisHistory([]);
    setError(null);
    interactionHistoryRef.current = [];
    contextUtterancesRef.current = [];
    priorGoalStateRef.current = null;
  }, []);

  return { latestAnalysis, analysisHistory, isAnalyzing, error, analyze, clearSession };
}