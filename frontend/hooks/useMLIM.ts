"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import {
  runMLIMAnalysis,
  streamMlimAnalysis,
  getSessionAnalyses,
  MLIMLayerName,
  MLIMLayerData,
} from "@/lib/mlim-api";
import {
  MLIMAnalysis,
  InteractionEntry,
  GoalState,
  MLIMAnalyzeRequest,
  ASLOutput,
  PELOutput,
  GSTLOutput,
  IFLOutput,
} from "@/types/mlim";

export interface MLIMStreamingLayers {
  asl: ASLOutput | null;
  pel: PELOutput | null;
  gstl: GSTLOutput | null;
  ifl: IFLOutput | null;
}

const EMPTY_STREAMING_LAYERS: MLIMStreamingLayers = {
  asl: null,
  pel: null,
  gstl: null,
  ifl: null,
};

export interface MLIMAnalyzeParams {
  sessionId: string;
  questionId: string;
  questionText: string;
  answerText: string;
  jobRole: string;
  faceSnapshot?: Record<string, unknown> | null;
  voiceFeatures?: Record<string, unknown> | null;
}

export interface UseMLIMState {
  latestAnalysis: MLIMAnalysis | null;
  analysisHistory: MLIMAnalysis[];
  isAnalyzing: boolean;
  error: string | null;
  streamingLayers: MLIMStreamingLayers;
  isStreaming: boolean;
  analyze: (params: MLIMAnalyzeParams) => Promise<MLIMAnalysis | null>;
  analyzeStreaming: (params: MLIMAnalyzeParams) => Promise<MLIMAnalysis | null>;
  clearSession: () => void;
}

export function useMLIM(): UseMLIMState {
  const [latestAnalysis, setLatestAnalysis] = useState<MLIMAnalysis | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<MLIMAnalysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingLayers, setStreamingLayers] = useState<MLIMStreamingLayers>(EMPTY_STREAMING_LAYERS);
  const [isStreaming, setIsStreaming] = useState(false);

  const interactionHistoryRef = useRef<InteractionEntry[]>([]);
  const contextUtterancesRef = useRef<string[]>([]);
  const priorGoalStateRef = useRef<GoalState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const buildRequest = useCallback((params: MLIMAnalyzeParams): MLIMAnalyzeRequest => ({
    session_id: params.sessionId,
    question_id: params.questionId,
    question_text: params.questionText,
    answer_text: params.answerText,
    job_role: params.jobRole,
    context_utterances: contextUtterancesRef.current,
    interaction_history: interactionHistoryRef.current,
    prior_goal_state: priorGoalStateRef.current,
    face_snapshot: params.faceSnapshot ?? null,
    voice_features: params.voiceFeatures ?? null,
  }), []);

  const recordResult = useCallback((params: MLIMAnalyzeParams, result: MLIMAnalysis) => {
    contextUtterancesRef.current = [...contextUtterancesRef.current.slice(-4), params.answerText];

    interactionHistoryRef.current = [
      ...interactionHistoryRef.current,
      {
        question: params.questionText,
        answer: params.answerText,
        score: Math.round((result.gstl.readiness_estimate ?? 0.5) * 10),
        intent_label: result.ifl.intent_label,
        timestamp: result.timestamp,
      },
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
      hiring_readiness_signal: result.gstl.hiring_readiness_signal,
      belief_update_trace: result.gstl.belief_update_trace,
      goal_drift_kl_divergence: result.gstl.goal_drift_kl_divergence,
    };

    setLatestAnalysis(result);
    setAnalysisHistory((prev) => [...prev, result]);
  }, []);

  const analyze = useCallback(async (params: MLIMAnalyzeParams): Promise<MLIMAnalysis | null> => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const req = buildRequest(params);
      const result = await runMLIMAnalysis(req);
      recordResult(params, result);
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "MLIM analysis failed");
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [buildRequest, recordResult]);

  const analyzeStreaming = useCallback((params: MLIMAnalyzeParams): Promise<MLIMAnalysis | null> => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsStreaming(true);
    setError(null);
    setStreamingLayers(EMPTY_STREAMING_LAYERS);

    const req = buildRequest(params);

    return new Promise<MLIMAnalysis | null>((resolve) => {
      streamMlimAnalysis(
        req,
        (layer: MLIMLayerName, data: MLIMLayerData) => {
          if (controller.signal.aborted) return;
          setStreamingLayers((prev) => ({ ...prev, [layer]: data }));
        },
        (result: MLIMAnalysis) => {
          if (controller.signal.aborted) {
            resolve(null);
            return;
          }
          recordResult(params, result);
          setIsStreaming(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
          resolve(result);
        },
        (message: string) => {
          if (controller.signal.aborted) {
            resolve(null);
            return;
          }
          setError(message);
          setIsStreaming(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
          resolve(null);
        },
        controller.signal
      );
    });
  }, [buildRequest, recordResult]);

  const clearSession = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setLatestAnalysis(null);
    setAnalysisHistory([]);
    setError(null);
    setStreamingLayers(EMPTY_STREAMING_LAYERS);
    setIsStreaming(false);
    interactionHistoryRef.current = [];
    contextUtterancesRef.current = [];
    priorGoalStateRef.current = null;
  }, []);

  return {
    latestAnalysis,
    analysisHistory,
    isAnalyzing,
    error,
    streamingLayers,
    isStreaming,
    analyze,
    analyzeStreaming,
    clearSession,
  };
}

export interface UseSessionAnalysesState {
  analyses: MLIMAnalysis[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSessionAnalyses(sessionId: string | null | undefined): UseSessionAnalysesState {
  const [analyses, setAnalyses] = useState<MLIMAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(!!sessionId);
  const [error, setError] = useState<string | null>(null);
  const [refetchIndex, setRefetchIndex] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      setAnalyses([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getSessionAnalyses(sessionId)
      .then((result) => {
        if (cancelled) return;
        setAnalyses(result);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load MLIM analyses");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, refetchIndex]);

  const refetch = useCallback(() => {
    setRefetchIndex((i) => i + 1);
  }, []);

  return { analyses, loading, error, refetch };
}