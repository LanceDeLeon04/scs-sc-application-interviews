export type ApplicantStatus = "Pending" | "Evaluated" | "Qualified" | "Disqualified";

export type Recommendation =
  | "Highly Recommended"
  | "Recommended"
  | "Recommended with Reservations"
  | "Not Recommended";

export interface Position {
  id: string;
  name: string;
  description: string | null;
  max_slots: number;
  created_at: string;
}

export interface Applicant {
  id: string;
  full_name: string;
  photo_url: string | null;
  email: string | null;
  course: string | null;
  year_level: string | null;
  position_applied_id: string | null;
  position_assigned_id: string | null;
  status: ApplicantStatus;
  created_at: string;
  // joined
  position_applied?: Position | null;
  position_assigned?: Position | null;
}

export type UserRole = "commissioner" | "evaluator";

export interface EvaluatorProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  role: UserRole;
}

export interface Assignment {
  applicant_id: string;
  evaluator_id: string;
}

export interface Evaluation {
  id: string;
  applicant_id: string;
  evaluator_id: string;
  evaluator_name?: string | null;
  leadership: number;
  communication: number;
  role_knowledge: number;
  problem_solving: number;
  commitment: number;
  professionalism: number;
  recommendation: Recommendation;
  notes: string | null;
  created_at: string;
}

export interface Criterion {
  key: keyof Pick<
    Evaluation,
    | "leadership"
    | "communication"
    | "role_knowledge"
    | "problem_solving"
    | "commitment"
    | "professionalism"
  >;
  label: string;
  description: string;
  weight: number; // fraction, e.g. 0.25
}

export const CRITERIA: Criterion[] = [
  {
    key: "leadership",
    label: "Leadership Potential",
    description:
      "Demonstrates initiative, responsibility, integrity, and the ability to lead and inspire others.",
    weight: 0.25,
  },
  {
    key: "communication",
    label: "Communication Skills",
    description:
      "Expresses ideas clearly, confidently, professionally, and listens effectively.",
    weight: 0.2,
  },
  {
    key: "role_knowledge",
    label: "Role Knowledge & Technical Competency",
    description:
      "Demonstrates understanding of the applied position, its responsibilities, and relevant technical skills.",
    weight: 0.2,
  },
  {
    key: "problem_solving",
    label: "Problem Solving & Critical Thinking",
    description:
      "Provides logical, practical, and well-reasoned responses to situational questions.",
    weight: 0.15,
  },
  {
    key: "commitment",
    label: "Commitment & Motivation",
    description:
      "Shows genuine interest in serving the student body and willingness to fulfill responsibilities.",
    weight: 0.1,
  },
  {
    key: "professionalism",
    label: "Professionalism & Personality",
    description:
      "Displays confidence, respect, ethical behavior, preparedness, and a positive attitude.",
    weight: 0.1,
  },
];

export const RATING_SCALE = [
  { value: 5, label: "Outstanding", description: "Exceeds expectations; demonstrates exceptional competency." },
  { value: 4, label: "Very Good", description: "Meets expectations with only minor areas for improvement." },
  { value: 3, label: "Satisfactory", description: "Adequately meets expectations." },
  { value: 2, label: "Needs Improvement", description: "Shows limited competency and requires significant development." },
  { value: 1, label: "Poor", description: "Does not demonstrate the required competency." },
];

export const RECOMMENDATIONS: Recommendation[] = [
  "Highly Recommended",
  "Recommended",
  "Recommended with Reservations",
  "Not Recommended",
];

export function weightedScore(e: Pick<Evaluation, (typeof CRITERIA)[number]["key"]>): number {
  const raw = CRITERIA.reduce((sum, c) => sum + (e[c.key] ?? 0) * c.weight, 0);
  return (raw / 5) * 100; // percentage out of 100
}
