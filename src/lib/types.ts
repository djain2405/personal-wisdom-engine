export type ProviderName = "claude" | "gemini" | "openai";

export type SourceType =
  | "inbox"
  | "transcripts"
  | "books"
  | "videos"
  | "journal"
  | "reflections"
  | "voice_notes"
  | "quotes"
  | "articles"
  | "personal_lessons";

export type DocumentStatus = "pending" | "processing" | "ready" | "error";

export type PrincipleCategory =
  | "Identity"
  | "Mindset"
  | "Relationships"
  | "Health"
  | "Career"
  | "Productivity"
  | "Emotional Regulation"
  | "Manifestation"
  | "Confidence"
  | "Money"
  | "Purpose"
  | "Creativity"
  | "Habits"
  | "Discipline"
  | "Leadership"
  | "Communication"
  | "Spirituality"
  | "Learning"
  | "Decision Making";

export const PRINCIPLE_CATEGORIES: PrincipleCategory[] = [
  "Identity",
  "Mindset",
  "Relationships",
  "Health",
  "Career",
  "Productivity",
  "Emotional Regulation",
  "Manifestation",
  "Confidence",
  "Money",
  "Purpose",
  "Creativity",
  "Habits",
  "Discipline",
  "Leadership",
  "Communication",
  "Spirituality",
  "Learning",
  "Decision Making",
];

export const SOURCE_TYPES: SourceType[] = [
  "inbox",
  "transcripts",
  "books",
  "videos",
  "journal",
  "reflections",
  "voice_notes",
  "quotes",
  "articles",
  "personal_lessons",
];

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  ai_provider: string | null;
  created_at: string;
  updated_at: string;
};

export type IdentityMemory = {
  id: string;
  user_id: string;
  dream_identity: string | null;
  values: string | null;
  goals: string | null;
  current_habits: string | null;
  challenges: string | null;
  life_areas: string | null;
  suggested_actions_history: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Document = {
  id: string;
  user_id: string;
  source_type: SourceType;
  title: string;
  path: string;
  raw_text: string | null;
  status: DocumentStatus;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Principle = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  explanation: string | null;
  category: string | null;
  examples: string[] | null;
  action_steps: string[] | null;
  questions: string[] | null;
  related_principle_ids: string[] | null;
  confidence_score: number;
  frequency_score: number;
  created_at: string;
  updated_at: string;
};

export type DailyBrief = {
  id: string;
  user_id: string;
  brief_date: string;
  todays_identity: string | null;
  keystone_habit: string | null;
  principle_to_practice: string | null;
  principle_id: string | null;
  challenge: string | null;
  reflection_question: string | null;
  evening_prompt: string | null;
  priorities: string | null;
  mindset_reminder: string | null;
  mantra: string | null;
  raw_json: unknown;
  created_at: string;
  updated_at: string;
};

export type EveningReview = {
  id: string;
  user_id: string;
  review_date: string;
  narrative: string;
  wins: string | null;
  patterns: string | null;
  identity_reinforce: string | null;
  tomorrow: string | null;
  analysis_json: unknown;
  created_at: string;
  updated_at: string;
};

export type WeeklyReview = {
  id: string;
  user_id: string;
  week_start: string;
  wins: string | null;
  lessons: string | null;
  patterns: string | null;
  repeated_mistakes: string | null;
  recurring_thoughts: string | null;
  best_principles: string | null;
  focus_next: string | null;
  raw_json: unknown;
  created_at: string;
  updated_at: string;
};

export type MonthlyReport = {
  id: string;
  user_id: string;
  month_start: string;
  identity_shifts: string | null;
  growth: string | null;
  habit_trends: string | null;
  emotional_trends: string | null;
  what_improved: string | null;
  what_needs_work: string | null;
  recommended_principles: string | null;
  raw_json: unknown;
  created_at: string;
  updated_at: string;
};

export type Habit = {
  id: string;
  user_id: string;
  document_id: string | null;
  principle_id: string | null;
  title: string;
  description: string | null;
  category: string | null;
  created_at: string;
};

export type MorningCheckin = {
  id: string;
  user_id: string;
  checkin_date: string;
  intention: string | null;
  becoming_identity: string | null;
  gratitude: string[];
  reflection: string | null;
  reflection_prompt: string | null;
  mood: number | null;
  energy: number | null;
  created_at: string;
  updated_at: string;
};

export type TrackedHabit = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type HabitLog = {
  id: string;
  user_id: string;
  tracked_habit_id: string;
  log_date: string;
  done: boolean;
  created_at: string;
};

export type HabitWithProgress = TrackedHabit & {
  completedToday: boolean;
  currentStreak: number;
  completionRate7d: number;
  logs: Pick<HabitLog, "log_date" | "done">[];
};

export type Quote = {
  id: string;
  user_id: string;
  document_id: string | null;
  principle_id: string | null;
  text: string;
  attribution: string | null;
  created_at: string;
};

