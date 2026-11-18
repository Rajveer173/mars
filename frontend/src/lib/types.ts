/** Shapes returned by the API, named after what the backend services return. */

export interface CourseRef {
  id: string;
  name: string;
  code: string;
}

export interface Paged<T> {
  items: T[];
  meta: { page: number; limit: number; total: number; pages: number };
}

export type QuestionType = 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'MATCH' | 'CODING' | 'SUBJECTIVE';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED';

export interface AssignedTest {
  requiresPassword?: boolean;
  id: string;
  title: string;
  description: string | null;
  course: CourseRef | null;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  negativeMarks: number;
  maxAttempts: number;
  questionCount: number;
  startAt: string | null;
  endAt: string | null;
  started: boolean;
  ended: boolean;
  attemptsUsed: number;
  bestScore: number | null;
  lastSubmittedAt: string | null;
  attemptsLeft: number;
  canAttempt: boolean;
}

export interface ResultRow {
  id: string;
  status: string;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  timeTakenSeconds: number | null;
  startedAt: string;
  submittedAt: string | null;
  suspiciousEventCount: number;
  test: { id: string; title: string; course: string | null; totalMarks: number; passingMarks: number; negativeMarks: number };
  student?: { id: string; fullName: string | null; email: string };
}

export interface ResultQuestion {
  questionId: string;
  answerId: string | null;
  type: QuestionType;
  text: string;
  difficulty: Difficulty;
  marks: number;
  negativeMarks: number;
  explanation: string | null;
  options: { id: string; text: string; isCorrect: boolean; selected: boolean }[];
  answerJson: unknown;
  isCorrect: boolean | null;
  marksObtained: number | null;
  requiresManualGrading: boolean;
}

export interface ResultDetail {
  attempt: {
    id: string;
    status: string;
    score: number | null;
    percentage: number | null;
    passed: boolean | null;
    timeTakenSeconds: number | null;
    startedAt: string;
    submittedAt: string | null;
    suspiciousEvents: { type: string; at: string }[];
  };
  test: {
    id: string;
    title: string;
    description: string | null;
    totalMarks: number;
    passingMarks: number;
    negativeMarks: number;
    course: { id: string; name: string } | null;
  };
  student: { id: string; fullName: string | null; email: string };
  questions: ResultQuestion[];
}

export interface StudentAnalytics {
  kpis: {
    attempts: number;
    avgScore: number;
    passRate: number;
    coursesEnrolled: number;
    lessonsCompleted: number;
    streakDays: number;
  };
  series: { date: string; attempts: number; avgScore: number }[];
  byCourse: { courseId: string; title: string; progress: number; avgScore: number }[];
  recentResults: {
    attemptId: string;
    testTitle: string;
    score: number;
    percentage: number;
    passed: boolean;
    submittedAt: string | null;
  }[];
}

export interface Overview {
  range: string;
  kpis: {
    attempts: number;
    avgScore: number;
    passRate: number;
    activeStudents: number;
    publishedTests: number;
    deltaAttempts: number;
    deltaAvgScore: number;
    deltaPassRate: number;
  };
  series: { date: string; attempts: number; avgScore: number; passRate: number }[];
  scoreDistribution: { bucket: string; count: number }[];
  topTests: { id: string; title: string; attempts: number; avgScore: number; passRate: number }[];
  recentActivity: { id: string; type: 'attempt' | 'test' | 'enrolment'; message: string; at: string }[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  description: string | null;
  category: string | null;
  createdAt: string;
  _count?: { classBatches?: number; tests?: number; modules?: number; assignments?: number };
}

export interface LessonOutline {
  id: string;
  title: string;
  type: string;
  durationMin: number | null;
  orderIndex: number;
}

export interface ModuleOutline {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  lessons: LessonOutline[];
}
