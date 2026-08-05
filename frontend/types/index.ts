export type Difficulty = "easy" | "medium" | "hard";
export type Category = "technical" | "behavioral" | "scenario";
export type Correctness = "Correct" | "Partially Correct" | "Incorrect";
export type Mode = "practice" | "simulation";
export type Sentiment = "confident" | "calm" | "stressed" | "anxious" | "uncertain" | "evasive" | "cheated" | "neutral";

export interface Question {
  id: string;
  text: string;
  category: Category;
  difficulty: Difficulty;
  expected_topics: string[];
}

export interface Feedback {
  question_id: string;
  correctness: Correctness;
  score: number;
  strengths: string[];
  weaknesses: string[];
  ideal_answer: string;
  suggestions: string[];
  sentiment: Sentiment;
  intent: string;
  answer_tips: string[];
}

export interface CategoryScore {
  technical_knowledge: number;
  communication: number;
  clarity: number;
  confidence: number;
}

export interface IntegritySummary {
  integrity_score: number;
  tab_switches: number;
  copy_pastes: number;
  cheating_detection_count: number;
  total_violations: number;
}

export interface Report {
  session_id: string;
  job_role: string;
  mode: Mode;
  overall_score: number;
  category_scores: CategoryScore;
  weak_areas: string[];
  recommended_topics: string[];
  suggested_improvements: string[];
  communication_improvement: string[];
  body_language_improvement: string[];
  brutal_assessment: string;
  overall_sentiment: string;
  overall_intent: string;
  question_breakdown: QuestionBreakdown[];
  integrity_summary: IntegritySummary;
  total_questions: number;
  completed_questions: number;
  hiring_recommendation?: string;
}

export interface QuestionBreakdown {
  question: string;
  category: Category;
  difficulty: Difficulty;
  answer: string;
  score: number;
  correctness: Correctness;
  sentiment: Sentiment;
  intent: string;
  answer_tips: string[];
  ideal_answer: string;
}

export interface Session {
  id: string;
  mode: Mode;
  job_role: string;
  job_description: string;
  created_at: string;
  completed_at?: string;
  overall_score?: number;
}