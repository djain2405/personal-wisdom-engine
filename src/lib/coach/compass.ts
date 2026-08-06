/** Shared Daily Compass copy for Morning / Coach / Evening / Weekly. */

export const COMPASS = {
  morning: {
    title: "Morning Ritual",
    subtitle: "Who am I becoming today? Write one sentence. Everything else flows from that.",
    becomingLabel: "Who am I becoming today?",
    becomingPlaceholder: "Today I am becoming someone who…",
    becomingHelper:
      "Example: Today I am becoming someone who follows through with joy.",
  },
  midday: {
    label: "Midday check",
    question: "Where is my attention right now?",
    redirect:
      "If it's on comparison, worry, or overthinking, gently redirect it. What deserves my attention instead?",
  },
  decision: {
    label: "Before you decide",
    question: "What does my future self do now?",
    examples:
      "Future you probably: sends the email, goes for the walk, publishes the post, rests when exhausted, says no when something isn't aligned.",
  },
  evening: {
    title: "Evening Review",
    subtitle:
      "What evidence did I collect today? Write 3 bullets — that's how identity compounds.",
    question: "What evidence did I collect today?",
    bulletPlaceholders: [
      "I kept my promise to…",
      "I chose… instead of…",
      "I was fully present when…",
    ],
  },
  weekly: {
    title: "Weekly Reset",
    subtitle:
      "Once a week is enough. Revisit the six Compass questions, then let the coach synthesize.",
    questions: [
      {
        key: "becoming",
        label: "Who am I becoming?",
      },
      {
        key: "attention",
        label: "What got my attention this week?",
      },
      {
        key: "standards",
        label: "What standards did I live by?",
      },
      {
        key: "presence",
        label: "When was I fully present?",
      },
      {
        key: "future_actions",
        label: "What actions did Future Me take?",
      },
      {
        key: "evidence",
        label: "What evidence did I collect?",
      },
    ] as const,
  },
} as const;

export type WeeklyCompassAnswers = {
  becoming: string;
  attention: string;
  standards: string;
  presence: string;
  future_actions: string;
  evidence: string;
};

export function defaultMiddayCheck() {
  return `${COMPASS.midday.question}\n\n${COMPASS.midday.redirect}`;
}

export function defaultDecisionFilter() {
  return `${COMPASS.decision.question}\n\n${COMPASS.decision.examples}`;
}

export function defaultEveningPrompt() {
  return COMPASS.evening.question;
}
