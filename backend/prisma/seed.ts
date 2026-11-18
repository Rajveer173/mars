// Demo seed for Meridian Institute of Technology (fictional).
//
//   npm run seed              seeds an empty database; refuses if users exist
//   npm run seed -- --reset   deletes every row first, then seeds
//
// Content lives in ./seed-data; this file only decides ids, dates and derived
// values. Every random choice comes from a seeded PRNG, so two runs produce the
// same data. Dates are offsets from "now", so upcoming tests stay upcoming.
//
// The seed runs outside the app, so it loads .env itself rather than
// inheriting DATABASE_URL from an already-booted process.
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { COURSES, type SeedCourse } from './seed-data/courses.js';
import { INSTITUTE_DOCUMENTS } from './seed-data/documents.js';
import {
  ANNOUNCEMENTS, ASSIGNMENTS, CODE_SUBMISSIONS, CODING_PROBLEMS, DISCUSSIONS, FEEDBACK, NOTIFICATIONS, REVIEWS, testTitle,
} from './seed-data/extras.js';
import {
  ACADEMIC_YEAR, DEMO_PASSWORD, DEPARTMENTS, EMAIL_DOMAIN, ENROLMENT_RULES, ORG, PLACEMENT_OFFICER, PRIMARY_STUDENT,
  SKILLS, STAFF, STUDENT_NAMES, USER_AGENTS, type SeedDepartment,
} from './seed-data/people.js';
import {
  APPLICATION_NOTES, APPLICATION_PROGRESS, DRIVES, PLACEMENT_BATCH_YEAR, PRIMARY_APPLICATIONS, type SeedDrive,
} from './seed-data/placements.js';
import type { Diff, QType, SeedQuestion } from './seed-data/types.js';

const prisma = new PrismaClient();

/* ------------------------------------------------------------------ time */

const NOW = new Date();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const ago = (ms: number): Date => new Date(NOW.getTime() - ms);
const ahead = (ms: number): Date => new Date(NOW.getTime() + ms);
const plus = (date: Date, ms: number): Date => new Date(date.getTime() + ms);

/** End of the calendar day `days` from today in IST, as the admin form stores a date-only deadline. */
function istEndOfDay(days: number): Date {
  const ist = new Date(NOW.getTime() + days * DAY + 330 * MIN);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 18, 29, 59, 999));
}

/** 10:00 IST on the calendar day `days` from today (drive or interview day). */
function istMorning(days: number): Date {
  const end = istEndOfDay(days);
  return new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate(), 4, 30, 0, 0));
}

/* ------------------------------------------------------------------ PRNG */

type Rng = () => number;

function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One independent stream per purpose, so adding data in one area does not reshuffle another. */
const stream = (label: string): Rng => {
  let h = 2166136261;
  for (let i = 0; i < label.length; i += 1) h = Math.imul(h ^ label.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
};

const between = (r: Rng, lo: number, hi: number): number => lo + r() * (hi - lo);
const intBetween = (r: Rng, lo: number, hi: number): number => Math.floor(between(r, lo, hi + 1));
const chance = (r: Rng, p: number): boolean => r() < p;
const pick = <T>(r: Rng, items: readonly T[]): T => items[Math.floor(r() * items.length)];
const shuffled = <T>(r: Rng, items: readonly T[]): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

const idRng = stream('ids');
const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
/** cuid-shaped and deterministic, so related rows can be built in memory and bulk-inserted. */
const newId = (): string => {
  let id = 'c';
  for (let i = 0; i < 24; i += 1) id += ID_ALPHABET[Math.floor(idRng() * 36)];
  return id;
};

/* ------------------------------------------------------- in-memory shapes */

type DeptCode = SeedDepartment['code'];

interface Person {
  id: string;
  username: string;
  email: string;
  fullName: string;
}

interface Student extends Person {
  dept: DeptCode;
  rollNumber: string;
  primary: boolean;
  /** Hidden skill level, 0.35 to 0.95; drives every generated result. */
  ability: number;
  /** Small per-course shift on top of ability, keyed by course code. */
  affinity: Record<string, number>;
  courses: string[];
}

interface QRow {
  id: string;
  courseCode: string;
  lesson: number;
  type: QType;
  topic: string;
  difficulty: Diff;
  marks: number;
  negative: number;
  estimated: number;
  options: { id: string; correct: boolean }[];
  seed: SeedQuestion;
}

type TestKind = 'quiz1' | 'midterm' | 'practice' | 'quiz2' | 'final';

interface TestRow {
  id: string;
  kind: TestKind;
  courseCode: string;
  title: string;
  questions: QRow[];
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number;
  startAt: Date | null;
  endAt: Date | null;
}

interface AnswerRow {
  questionId: string;
  optionId: string | null;
  answerJson?: Prisma.InputJsonObject;
  isCorrect: boolean | null;
  /** null only while the attempt is still in progress. */
  marks: number | null;
  /** A teacher awarded these marks by hand (descriptive answers). */
  manual: boolean;
  timeSpent: number;
}

interface ProctorEvent {
  type: string;
  severity: 'LOW' | 'MEDIUM';
  message?: string;
  at: Date;
}

interface AttemptRow {
  id: string;
  student: Student;
  test: TestRow;
  startedAt: Date;
  submittedAt: Date | null;
  inProgress: boolean;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  timeTaken: number | null;
  answers: AnswerRow[];
  events: ProctorEvent[];
  suspicionScore: number;
}

/* ---------------------------------------------------------- marking rules */

const DIFFICULTY: Record<Diff, { marks: number; seconds: number; adjust: number }> = {
  EASY: { marks: 1, seconds: 45, adjust: 0.15 },
  MEDIUM: { marks: 2, seconds: 75, adjust: 0 },
  HARD: { marks: 3, seconds: 120, adjust: -0.15 },
  EXPERT: { marks: 4, seconds: 180, adjust: -0.27 },
};
const SUBJECTIVE = { marks: 5, seconds: 420 };
/** Regulation 2: 0.25 off for a wrong objective answer. The app grades from the question's own value. */
const NEGATIVE_MARKS = 0.25;
const PASS_FRACTION = 0.4;

const normalise = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * Port of marksForQuestion in src/services/evaluation.service.ts, so a seeded
 * answer carries exactly what the app would have written for it.
 */
function evaluate(q: QRow, answer: Pick<AnswerRow, 'optionId' | 'answerJson'>): { marks: number; isCorrect: boolean | null } {
  if (answer.optionId == null && answer.answerJson == null) return { marks: 0, isCorrect: null };
  const wrong = { marks: q.negative > 0 ? -q.negative : 0, isCorrect: false };
  const right = { marks: q.marks, isCorrect: true };

  if (q.type === 'SINGLE' || q.type === 'TRUE_FALSE') {
    return q.options.find((o) => o.id === answer.optionId)?.correct ? right : wrong;
  }
  if (q.type === 'MULTIPLE') {
    const selected = new Set((answer.answerJson?.optionIds as string[] | undefined) ?? []);
    const correct = q.options.filter((o) => o.correct).map((o) => o.id);
    return correct.length === selected.size && correct.every((id) => selected.has(id)) ? right : wrong;
  }
  if (q.type === 'FILL_BLANK') {
    const given = normalise(String(answer.answerJson?.text ?? ''));
    return given && q.seed.accepted.map(normalise).includes(given) ? right : wrong;
  }
  return { marks: 0, isCorrect: null }; // SUBJECTIVE: a teacher grades it.
}

/**
 * Attempt totals as the app computes them. evaluateAttempt floors the sum at
 * zero; once a teacher grades a descriptive answer, recomputeAttemptScore sums
 * marksObtained without that floor.
 */
function totals(test: TestRow, answers: AnswerRow[]): { score: number; percentage: number; passed: boolean } {
  const sum = answers.reduce((s, a) => s + (a.marks ?? 0), 0);
  const score = answers.some((a) => a.manual) ? sum : Math.max(0, sum);
  return {
    score: round2(score),
    percentage: Math.round((score / test.totalMarks) * 10000) / 100,
    passed: score >= test.passingMarks,
  };
}

/* ------------------------------------------------------ content self-check */

const wordCount = (text: string): number => text.split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;

/** Fails fast, before anything is deleted, if the content files break a rule the seed relies on. */
function assertContent(): void {
  const problems: string[] = [];
  const short = (label: string, value: string) => {
    if (value.length > 191) problems.push(`${label} is ${value.length} characters; the column holds 191`);
  };

  if (COURSES.length !== 4) problems.push(`expected 4 courses, found ${COURSES.length}`);
  for (const course of COURSES) {
    short(`${course.code} description`, course.description);
    const lessons = course.modules.flatMap((m) => m.lessons);
    if (course.modules.length !== 3 || lessons.length !== 9) problems.push(`${course.code}: expected 3 modules x 3 lessons`);
    const topics = lessons.map((l) => l.topic);
    if (new Set(topics).size !== topics.length) problems.push(`${course.code}: lesson topics are not unique`);
    for (const lesson of lessons) {
      const words = wordCount(lesson.content);
      if (words < 350 || words > 550) problems.push(`${course.code} "${lesson.title}": ${words} words, expected 350-550`);
      if (course.questions.filter((q) => q.topic === lesson.topic).length < 2) {
        problems.push(`${course.code} "${lesson.topic}": needs at least 2 questions`);
      }
    }
    if (course.questions.length < 26 || course.questions.length > 30) {
      problems.push(`${course.code}: ${course.questions.length} questions, expected about 28`);
    }
    course.questions.forEach((q, i) => {
      const at = `${course.code} question ${i + 1}`;
      if (!topics.includes(q.topic)) problems.push(`${at}: topic "${q.topic}" matches no lesson`);
      if (!q.explanation.trim()) problems.push(`${at}: no explanation`);
      q.options.forEach((o) => short(`${at} option`, o));
      const correct = q.correct.length;
      if (q.type === 'SINGLE' && (q.options.length !== 4 || correct !== 1)) problems.push(`${at}: SINGLE needs 4 options, 1 correct`);
      if (q.type === 'MULTIPLE' && (q.options.length !== 4 || correct < 2 || correct > 3)) problems.push(`${at}: MULTIPLE needs 4 options, 2-3 correct`);
      if (q.type === 'TRUE_FALSE' && (q.options.length !== 2 || correct !== 1)) problems.push(`${at}: TRUE_FALSE needs 2 options, 1 correct`);
      if (q.correct.some((c) => c < 0 || c >= q.options.length)) problems.push(`${at}: correct index out of range`);
      if (q.type === 'FILL_BLANK') {
        const accepted = q.accepted.map(normalise);
        if (!accepted.length || !q.distractors.length) problems.push(`${at}: FILL_BLANK needs accepted answers and distractors`);
        if (q.distractors.some((d) => accepted.includes(normalise(d)))) problems.push(`${at}: a distractor is also an accepted answer`);
      }
      if (q.type === 'SUBJECTIVE' && !q.samples) problems.push(`${at}: SUBJECTIVE needs sample answers`);
    });
  }

  if (INSTITUTE_DOCUMENTS.length !== 2) problems.push('expected 2 institute documents');
  for (const doc of INSTITUTE_DOCUMENTS) {
    const words = wordCount(doc.text);
    if (words < 400 || words > 600) problems.push(`document "${doc.title}": ${words} words, expected 400-600`);
  }
  for (const [user, items] of Object.entries(NOTIFICATIONS)) {
    for (const n of items) {
      short(`${user} notification title`, n.title);
      short(`${user} notification message`, n.message);
    }
  }
  const students = Object.values(STUDENT_NAMES).flat().length + 1;
  if (students !== 36) problems.push(`expected 36 students, found ${students}`);

  if (problems.length) throw new Error(`Seed content check failed:\n  - ${problems.join('\n  - ')}`);
}

/* ----------------------------------------------------------------- reset */

/** Deletes every row, children before parents, so no foreign key blocks a delete. */
async function reset(): Promise<void> {
  const deletions: (() => Prisma.PrismaPromise<Prisma.BatchPayload>)[] = [
    () => prisma.agentStep.deleteMany(),
    () => prisma.aIMessage.deleteMany(),
    () => prisma.agentRun.deleteMany(),
    () => prisma.aIConversation.deleteMany(),
    () => prisma.knowledgeChunk.deleteMany(),
    () => prisma.knowledgeDocument.deleteMany(),
    () => prisma.recommendation.deleteMany(),
    () => prisma.proctoringSnapshot.deleteMany(),
    () => prisma.proctoringEvent.deleteMany(),
    () => prisma.proctoringSession.deleteMany(),
    () => prisma.codeSubmission.deleteMany(),
    () => prisma.codingTestCase.deleteMany(),
    () => prisma.codingProblem.deleteMany(),
    () => prisma.placementApplication.deleteMany(),
    () => prisma.placementDrive.deleteMany(),
    () => prisma.placementProfile.deleteMany(),
    () => prisma.certificate.deleteMany(),
    () => prisma.leaderboard.deleteMany(),
    () => prisma.questionAnalytics.deleteMany(),
    () => prisma.attemptAnswer.deleteMany(),
    () => prisma.attempt.deleteMany(),
    () => prisma.testAssignment.deleteMany(),
    () => prisma.questionPoolQuestion.deleteMany(),
    () => prisma.questionPool.deleteMany(),
    () => prisma.testSection.deleteMany(),
    () => prisma.testQuestion.deleteMany(),
    () => prisma.test.deleteMany(),
    () => prisma.questionBankQuestion.deleteMany(),
    () => prisma.questionBank.deleteMany(),
    () => prisma.questionVersion.deleteMany(),
    () => prisma.questionTag.deleteMany(),
    () => prisma.questionOption.deleteMany(),
    () => prisma.question.deleteMany(),
    () => prisma.assignmentSubmission.deleteMany(),
    () => prisma.assignment.deleteMany(),
    () => prisma.recentlyViewed.deleteMany(),
    () => prisma.lessonProgress.deleteMany(),
    () => prisma.courseProgress.deleteMany(),
    () => prisma.resource.deleteMany(),
    () => prisma.lesson.deleteMany(),
    () => prisma.module.deleteMany(),
    () => prisma.enrollment.deleteMany(),
    () => prisma.classStudent.deleteMany(),
    () => prisma.classBatch.deleteMany(),
    () => prisma.courseRating.deleteMany(),
    () => prisma.courseDiscussion.deleteMany(),
    () => prisma.courseAnnouncement.deleteMany(),
    () => prisma.course.deleteMany(),
    () => prisma.fileUpload.deleteMany(),
    () => prisma.notification.deleteMany(),
    () => prisma.auditLog.deleteMany(),
    () => prisma.loginHistory.deleteMany(),
    () => prisma.verificationToken.deleteMany(),
    () => prisma.refreshToken.deleteMany(),
    () => prisma.batchStudent.deleteMany(),
    () => prisma.batch.deleteMany(),
    () => prisma.semester.deleteMany(),
    () => prisma.academicYear.deleteMany(),
    () => prisma.department.deleteMany(),
    () => prisma.orgMember.deleteMany(),
    () => prisma.user.deleteMany(),
    () => prisma.organization.deleteMany(),
  ];
  let removed = 0;
  for (const run of deletions) removed += (await run()).count;
  console.log(`--reset: deleted ${removed} existing rows.`);
}

/* ------------------------------------------------------------ simulation */

const emailOf = (username: string): string => `${username.replace(/_/g, '.')}@${EMAIL_DOMAIN}`;

/** Chance that a student answers a question correctly: ability and difficulty, or the primary student's topic profile. */
function chanceCorrect(student: Student, q: QRow): number {
  const adjust = DIFFICULTY[q.difficulty].adjust;
  if (student.primary) {
    const strength = PRIMARY_STUDENT.topicStrength[q.topic] ?? PRIMARY_STUDENT.defaultStrength;
    return clamp(strength + adjust * 0.3, 0.03, 0.98);
  }
  return clamp(student.ability + (student.affinity[q.courseCode] ?? 0) + adjust, 0.05, 0.97);
}

/**
 * Whether the student gets this question right. Classmates are decided by
 * chance. The primary student follows his topic profile exactly: a running
 * tally per topic turns a strength of 0.3 into roughly one right answer in
 * three, so his weak and strong topics do not depend on a lucky draw.
 */
const primaryTally = new Map<string, number>();
function answersCorrectly(r: Rng, student: Student, q: QRow, p: number): boolean {
  if (!student.primary) return chance(r, p);
  const tally = (primaryTally.get(q.topic) ?? 0.5) + p;
  primaryTally.set(q.topic, tally >= 1 ? tally - 1 : tally);
  return tally >= 1;
}

function correctAnswer(r: Rng, q: QRow): Pick<AnswerRow, 'optionId' | 'answerJson'> {
  const correct = q.options.filter((o) => o.correct).map((o) => o.id);
  if (q.type === 'MULTIPLE') return { optionId: null, answerJson: { optionIds: correct } };
  if (q.type === 'FILL_BLANK') return { optionId: null, answerJson: { text: pick(r, q.seed.accepted) } };
  return { optionId: correct[0] };
}

function wrongAnswer(r: Rng, q: QRow): Pick<AnswerRow, 'optionId' | 'answerJson'> {
  const correct = q.options.filter((o) => o.correct).map((o) => o.id);
  const incorrect = q.options.filter((o) => !o.correct).map((o) => o.id);
  if (q.type === 'MULTIPLE') {
    // Typical mistakes: one right option missed, or one wrong option added.
    const optionIds = chance(r, 0.5) ? correct.slice(1) : [...correct, pick(r, incorrect)];
    return { optionId: null, answerJson: { optionIds } };
  }
  if (q.type === 'FILL_BLANK') return { optionId: null, answerJson: { text: pick(r, q.seed.distractors) } };
  return { optionId: pick(r, incorrect) };
}

/** One student's answers to a list of questions, already evaluated. */
function answerQuestions(r: Rng, student: Student, questions: QRow[]): AnswerRow[] {
  const pace = 1.2 - 0.35 * student.ability;
  return questions.map((q): AnswerRow => {
    const p = chanceCorrect(student, q);
    if (q.type === 'SUBJECTIVE') {
      const quality = clamp(p + between(r, -0.12, 0.12), 0, 1);
      const band = quality >= 0.7 ? 'good' : quality >= 0.42 ? 'partial' : 'weak';
      const awarded = pick(r, band === 'good' ? [4, 4.5, 5] : band === 'partial' ? [2, 2.5, 3, 3.5] : [0.5, 1, 1.5]);
      // Some descriptive answers are still waiting for the teacher; never the primary student's.
      const graded = student.primary || !chance(r, 0.15);
      return {
        questionId: q.id,
        optionId: null,
        answerJson: { text: q.seed.samples?.[band] ?? '' },
        // gradeAnswer in result.service.ts marks a hand-graded answer isCorrect: true whatever the marks.
        isCorrect: graded ? true : null,
        marks: graded ? awarded : 0,
        manual: graded,
        timeSpent: Math.round(q.estimated * between(r, 0.6, 1.2) * pace),
      };
    }
    if (chance(r, 0.03 + (1 - p) * 0.14)) {
      return { questionId: q.id, optionId: null, isCorrect: null, marks: 0, manual: false, timeSpent: intBetween(r, 4, 20) };
    }
    const given = answersCorrectly(r, student, q, p) ? correctAnswer(r, q) : wrongAnswer(r, q);
    const result = evaluate(q, given);
    return {
      questionId: q.id,
      ...given,
      isCorrect: result.isCorrect,
      marks: result.marks,
      manual: false,
      timeSpent: Math.round(q.estimated * between(r, 0.45, 1.35) * pace),
    };
  });
}

/** A finished, evaluated attempt that started between the two given instants. */
function finishedAttempt(r: Rng, student: Student, test: TestRow, earliestStart: Date, latestStart: Date): AttemptRow {
  const answers = answerQuestions(r, student, test.questions);
  const limit = test.durationMinutes * 60;
  const spent = answers.reduce((s, a) => s + a.timeSpent, 0);
  if (spent > limit * 0.95) {
    // Ran short of time: every answer was squeezed proportionally.
    const scale = (limit * 0.95) / spent;
    for (const a of answers) a.timeSpent = Math.max(3, Math.floor(a.timeSpent * scale));
  }
  const timeTaken = Math.min(limit, answers.reduce((s, a) => s + a.timeSpent, 0) + intBetween(r, 15, 90));
  const startedAt = new Date(Math.floor(between(r, earliestStart.getTime(), latestStart.getTime()) / 1000) * 1000);
  return {
    id: newId(),
    student,
    test,
    startedAt,
    submittedAt: plus(startedAt, timeTaken * 1000),
    inProgress: false,
    ...totals(test, answers),
    timeTaken,
    answers,
    events: [],
    suspicionScore: 0,
  };
}

const EVENT_WEIGHT = { MEDIUM: 5, LOW: 2 } as const; // proctoring.service.ts: HIGH 10, MEDIUM 5, LOW 2
const MINOR_EVENTS = ['TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'CONTEXT_MENU', 'WINDOW_RESIZE'];

/** Proctoring events for a midterm attempt: mostly none, a few stray ones, or a flagged pattern. */
function proctor(r: Rng, attempt: AttemptRow, flagged: boolean): void {
  const counts: Record<string, number> = {};
  if (flagged) {
    Object.assign(counts, {
      PASTE: intBetween(r, 4, 7), COPY: intBetween(r, 1, 3), TAB_SWITCH: intBetween(r, 8, 14),
      FULLSCREEN_EXIT: intBetween(r, 2, 4), WINDOW_BLUR: intBetween(r, 2, 5), ALERT_SENT: 1,
    });
  } else if (chance(r, 0.5)) {
    for (let i = intBetween(r, 1, 3); i > 0; i -= 1) {
      const type = pick(r, MINOR_EVENTS);
      counts[type] = (counts[type] ?? 0) + 1;
    }
  }
  const span = (attempt.timeTaken ?? 0) * 1000;
  for (const [type, count] of Object.entries(counts)) {
    for (let i = 0; i < count; i += 1) {
      attempt.events.push({
        type,
        // attempt.service.ts logs copy and paste as MEDIUM and the rest as LOW; a proctor's alert is MEDIUM.
        severity: type === 'COPY' || type === 'PASTE' || type === 'ALERT_SENT' ? 'MEDIUM' : 'LOW',
        message: type === 'ALERT_SENT' ? 'Please stay on the examination window. Further violations will be reported.' : undefined,
        at: plus(attempt.startedAt, Math.floor(between(r, 0.05, 0.98) * span)),
      });
    }
  }
  attempt.events.sort((a, b) => a.at.getTime() - b.at.getTime());
  attempt.suspicionScore = Math.min(100, attempt.events.reduce((s, e) => s + EVENT_WEIGHT[e.severity], 0));
}

/* ------------------------------------------------------------------ main */

async function main(): Promise<void> {
  assertContent();

  const resetRequested = process.argv.includes('--reset');
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0 && !resetRequested) {
    console.error(
      `Refusing to seed: the User table already holds ${existingUsers} row(s).\n` +
        'Run "npm run seed -- --reset" to DELETE ALL DATA in this database and seed it again.',
    );
    process.exitCode = 1;
    return;
  }
  if (resetRequested) await reset();

  // Same approach as src/utils/password.ts: bcrypt at the configured cost.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, Number(process.env.BCRYPT_ROUNDS) || 12);

  /* ------------------------------------------------------- institute */

  const orgId = newId();
  await prisma.organization.create({
    data: { id: orgId, name: ORG.name, slug: ORG.slug, description: ORG.description, brandColor: ORG.brandColor, settings: ORG.settings, createdAt: ago(125 * DAY) },
  });

  const deptId: Record<DeptCode, string> = { CSE: newId(), IT: newId(), ECE: newId() };
  await prisma.department.createMany({
    data: DEPARTMENTS.map((d) => ({ id: deptId[d.code], organizationId: orgId, name: d.name, code: d.code, description: `Department of ${d.name}` })),
  });

  const yearId = newId();
  await prisma.academicYear.create({
    data: { id: yearId, organizationId: orgId, name: ACADEMIC_YEAR.name, startDate: ago(120 * DAY), endDate: ahead(245 * DAY), isActive: true },
  });
  const semesterIds = [newId(), newId()];
  await prisma.semester.createMany({
    data: [
      { id: semesterIds[0], academicYearId: yearId, name: ACADEMIC_YEAR.semesters[0], orderIndex: 1, startDate: ago(120 * DAY), endDate: ahead(45 * DAY) },
      { id: semesterIds[1], academicYearId: yearId, name: ACADEMIC_YEAR.semesters[1], orderIndex: 2, startDate: ahead(60 * DAY), endDate: ahead(245 * DAY) },
    ],
  });

  const batchId: Record<DeptCode, string> = { CSE: newId(), IT: newId(), ECE: newId() };
  const batchName = (code: DeptCode): string => `${code} ${ACADEMIC_YEAR.batchStartYear}-${ACADEMIC_YEAR.batchEndYear % 100}`;
  await prisma.batch.createMany({
    data: DEPARTMENTS.map((d) => ({
      id: batchId[d.code], departmentId: deptId[d.code], semesterId: semesterIds[0], name: batchName(d.code),
      code: `${d.code}-${ACADEMIC_YEAR.batchStartYear}`, startYear: ACADEMIC_YEAR.batchStartYear, endYear: ACADEMIC_YEAR.batchEndYear,
    })),
  });

  /* ---------------------------------------------------------- people */

  const staff: (Person & { role: (typeof STAFF)[number]['role'] })[] = STAFF.map((s) => ({
    id: newId(), username: s.username, email: emailOf(s.username), fullName: s.fullName, role: s.role,
  }));
  const staffBy = (username: string): Person => {
    const found = staff.find((s) => s.username === username);
    if (!found) throw new Error(`Unknown staff member "${username}"`);
    return found;
  };
  const admin = staffBy('admin');
  const proctorUser = staffBy('proctor');
  const officer = staffBy(PLACEMENT_OFFICER);

  const abilityRng = stream('students');
  const students: Student[] = [];
  for (const dept of DEPARTMENTS) {
    const names = dept.code === PRIMARY_STUDENT.dept ? [PRIMARY_STUDENT.fullName, ...STUDENT_NAMES[dept.code]] : STUDENT_NAMES[dept.code];
    names.forEach((fullName, i) => {
      const primary = fullName === PRIMARY_STUDENT.fullName;
      const username = primary ? PRIMARY_STUDENT.username : fullName.toLowerCase().replace(/[^a-z]+/g, '_');
      const rules = ENROLMENT_RULES[dept.code];
      const ability = round2(between(abilityRng, 0.35, 0.95));
      const optional = rules.maybe.filter(([, p]) => chance(abilityRng, p)).map(([code]) => code);
      const affinity: Record<string, number> = {};
      for (const course of COURSES) affinity[course.code] = round2(between(abilityRng, -0.08, 0.08));
      students.push({
        id: newId(), username, email: emailOf(username), fullName, dept: dept.code, primary,
        rollNumber: `${dept.code}${ACADEMIC_YEAR.batchStartYear}-${String(i + 1).padStart(3, '0')}`,
        ability: primary ? 0.74 : ability,
        affinity,
        courses: primary ? COURSES.map((c) => c.code) : [...rules.always, ...optional],
      });
    });
  }
  const primary = students.find((s) => s.primary);
  if (!primary) throw new Error('Primary student missing');
  const studentBy = (username: string): Student => {
    const found = students.find((s) => s.username === username);
    if (!found) throw new Error(`Unknown student "${username}"`);
    return found;
  };

  const loginRng = stream('logins');
  const birthYear = NOW.getUTCFullYear() - 21;
  await prisma.user.createMany({
    data: [
      ...staff.map((s, i): Prisma.UserCreateManyInput => ({
        id: s.id, email: s.email, username: s.username, fullName: s.fullName, passwordHash, role: s.role,
        qualification: STAFF[i].qualification, isEmailVerified: true, organizationId: orgId,
        createdAt: ago(122 * DAY), lastPasswordChangeAt: ago(122 * DAY),
      })),
      ...students.map((s): Prisma.UserCreateManyInput => ({
        id: s.id, email: s.email, username: s.username, fullName: s.fullName, passwordHash, role: 'STUDENT',
        qualification: `B.Tech. ${s.dept}, final year`, isEmailVerified: true, organizationId: orgId,
        dob: new Date(Date.UTC(birthYear, intBetween(loginRng, 0, 11), intBetween(loginRng, 1, 28))),
        createdAt: ago(104 * DAY), lastPasswordChangeAt: ago(104 * DAY),
        lastLoginAt: ago(between(loginRng, 2 * HOUR, 9 * DAY)),
      })),
    ],
  });
  await prisma.orgMember.createMany({
    data: [
      ...staff.map((s, i) => ({ organizationId: orgId, userId: s.id, role: STAFF[i].orgRole, joinedAt: ago(122 * DAY) })),
      ...students.map((s) => ({ organizationId: orgId, userId: s.id, role: 'MEMBER', joinedAt: ago(104 * DAY) })),
    ],
  });
  await prisma.batchStudent.createMany({ data: students.map((s) => ({ batchId: batchId[s.dept], studentId: s.id })) });

  /* --------------------------------------------- courses and lessons */

  const courseId: Record<string, string> = {};
  const lessonIds: Record<string, string[]> = {};
  const modules: Prisma.ModuleCreateManyInput[] = [];
  const lessons: Prisma.LessonCreateManyInput[] = [];
  for (const course of COURSES) {
    courseId[course.code] = newId();
    lessonIds[course.code] = [];
    course.modules.forEach((m, mi) => {
      const moduleId = newId();
      modules.push({ id: moduleId, courseId: courseId[course.code], title: m.title, description: m.description, orderIndex: mi, createdAt: ago(108 * DAY) });
      m.lessons.forEach((l, li) => {
        const id = newId();
        lessonIds[course.code].push(id);
        lessons.push({ id, moduleId, title: l.title, content: l.content, type: 'text', durationMin: l.durationMin, orderIndex: li, createdAt: ago(108 * DAY) });
      });
    });
  }
  await prisma.course.createMany({
    data: COURSES.map((c) => ({
      id: courseId[c.code], name: c.name, code: c.code, description: c.description, category: c.category,
      visibility: 'public', startDate: ago(100 * DAY), endDate: ahead(45 * DAY), organizationId: orgId, createdAt: ago(110 * DAY),
    })),
  });
  await prisma.module.createMany({ data: modules });
  await prisma.lesson.createMany({ data: lessons });

  /* ------------------------------------------- enrolments and classes */

  const enrolled = (course: SeedCourse): Student[] => students.filter((s) => s.courses.includes(course.code));
  const enrolRng = stream('enrolments');
  await prisma.enrollment.createMany({
    data: COURSES.flatMap((c) => enrolled(c).map((s) => ({ userId: s.id, courseId: courseId[c.code], status: 'active', enrolledAt: ago(between(enrolRng, 98 * DAY, 102 * DAY)) }))),
  });

  /** One class per course and batch that has students in it. */
  const classIds: Record<string, string[]> = {};
  const classes: Prisma.ClassBatchCreateManyInput[] = [];
  const classStudents: Prisma.ClassStudentCreateManyInput[] = [];
  for (const course of COURSES) {
    classIds[course.code] = [];
    for (const dept of DEPARTMENTS) {
      const members = enrolled(course).filter((s) => s.dept === dept.code);
      if (!members.length) continue;
      const id = newId();
      classIds[course.code].push(id);
      classes.push({ id, name: `${course.code} - ${batchName(dept.code)}`, courseId: courseId[course.code], batchId: batchId[dept.code], createdAt: ago(100 * DAY) });
      classStudents.push(...members.map((s) => ({ classId: id, studentId: s.id })));
    }
  }
  await prisma.classBatch.createMany({ data: classes });
  await prisma.classStudent.createMany({ data: classStudents });

  /* -------------------------------------------------------- questions */

  const questionRows: Record<string, QRow[]> = {};
  const questions: Prisma.QuestionCreateManyInput[] = [];
  const options: Prisma.QuestionOptionCreateManyInput[] = [];
  const tags: Prisma.QuestionTagCreateManyInput[] = [];
  const banks: Prisma.QuestionBankCreateManyInput[] = [];
  const bankQuestions: Prisma.QuestionBankQuestionCreateManyInput[] = [];
  const aptitudeBankId = newId();

  for (const course of COURSES) {
    const teacher = staffBy(course.teacher);
    const topics = course.modules.flatMap((m) => m.lessons.map((l) => l.topic));
    const bankId = newId();
    banks.push({ id: bankId, name: `${course.code} ${course.name}`, courseId: courseId[course.code], createdById: teacher.id, createdAt: ago(97 * DAY) });

    questionRows[course.code] = course.questions.map((q, qi): QRow => {
      const subjective = q.type === 'SUBJECTIVE';
      const row: QRow = {
        id: newId(), courseCode: course.code, lesson: topics.indexOf(q.topic), type: q.type, topic: q.topic, difficulty: q.difficulty,
        marks: subjective ? SUBJECTIVE.marks : DIFFICULTY[q.difficulty].marks,
        negative: subjective ? 0 : NEGATIVE_MARKS,
        estimated: subjective ? SUBJECTIVE.seconds : DIFFICULTY[q.difficulty].seconds,
        options: q.options.map((_, oi) => ({ id: newId(), correct: q.correct.includes(oi) })),
        seed: q,
      };
      // Stored the way the old seed and the evaluation service expect: option
      // indexes for MULTIPLE, the option text for TRUE_FALSE, accepted strings
      // for FILL_BLANK, nothing for SUBJECTIVE (graded by hand).
      const correctAnswer: Prisma.InputJsonValue | undefined =
        q.type === 'MULTIPLE' ? q.correct.map((optionIndex) => ({ optionIndex }))
          : q.type === 'TRUE_FALSE' ? [q.options[q.correct[0]].toLowerCase()]
            : q.type === 'FILL_BLANK' ? q.accepted
              : undefined;
      questions.push({
        id: row.id, text: q.text, type: q.type, difficulty: q.difficulty, bloomLevel: q.bloom, marks: row.marks, negativeMarks: row.negative,
        explanation: q.explanation, correctAnswer, reference: `${course.code}: ${course.modules[Math.floor(row.lesson / 3)].lessons[row.lesson % 3].title}`,
        estimatedTime: row.estimated, topic: q.topic, subtopic: course.modules[Math.floor(row.lesson / 3)].title,
        createdById: teacher.id, createdAt: ago(96 * DAY - qi * MIN),
      });
      q.options.forEach((text, oi) => options.push({ id: row.options[oi].id, questionId: row.id, text, isCorrect: row.options[oi].correct, orderIndex: oi }));
      for (const tag of new Set([course.code.toLowerCase(), ...q.tags])) tags.push({ questionId: row.id, tag });
      bankQuestions.push({ bankId, questionId: row.id, createdAt: ago(96 * DAY) });
      return row;
    });

    // The mixed placement bank reuses the first auto-graded question of every lesson.
    for (let lesson = 0; lesson < 9; lesson += 1) {
      const first = questionRows[course.code].find((q) => q.lesson === lesson && q.type !== 'SUBJECTIVE');
      if (first) bankQuestions.push({ bankId: aptitudeBankId, questionId: first.id, createdAt: ago(40 * DAY) });
    }
  }
  banks.push({ id: aptitudeBankId, name: 'Placement aptitude - CS core', courseId: null, createdById: officer.id, createdAt: ago(40 * DAY) });

  await prisma.question.createMany({ data: questions });
  await prisma.questionOption.createMany({ data: options });
  await prisma.questionTag.createMany({ data: tags });
  await prisma.questionBank.createMany({ data: banks });
  await prisma.questionBankQuestion.createMany({ data: bankQuestions });

  /* ------------------------------------------------------------ tests */

  /** Takes the first question of every list, then the second of every list, and so on. */
  const roundRobin = (lists: QRow[][], count: number): QRow[] => {
    const out: QRow[] = [];
    for (let depth = 0; out.length < count && lists.some((l) => depth < l.length); depth += 1) {
      for (const list of lists) if (depth < list.length && out.length < count) out.push(list[depth]);
    }
    return out;
  };

  const testRows: TestRow[] = [];
  const tests: Prisma.TestCreateManyInput[] = [];
  const testQuestions: Prisma.TestQuestionCreateManyInput[] = [];
  const testAssignments: Prisma.TestAssignmentCreateManyInput[] = [];

  COURSES.forEach((course, ci) => {
    const byLesson = Array.from({ length: 9 }, (_, lesson) => questionRows[course.code].filter((q) => q.lesson === lesson));
    const autoGraded = byLesson.map((list) => list.filter((q) => q.type !== 'SUBJECTIVE'));
    const lastModule = roundRobin(autoGraded.slice(6), 9);
    const quizEnd = ago((20 + ci) * DAY);
    const midtermEnd = ago((7 + ci) * DAY);
    const quiz2Start = ahead(3 * DAY + ci * 3 * HOUR);
    const modulesCovered = (from: number, to: number) => course.modules.slice(from, to).map((m) => m.title).join('; ');

    const plan: (Omit<TestRow, 'id' | 'courseCode' | 'totalMarks' | 'passingMarks' | 'title'> & Pick<Prisma.TestCreateManyInput,
      'description' | 'status' | 'examMode' | 'maxAttempts' | 'shuffleQuestions' | 'randomOptionOrder' | 'showResultImmediately' | 'gracePeriodMinutes'>)[] = [
      {
        kind: 'quiz1', questions: roundRobin(autoGraded.slice(0, 6), 10), durationMinutes: 20, startAt: plus(quizEnd, -DAY), endAt: quizEnd,
        description: `Quiz on ${modulesCovered(0, 2)}.`, status: 'CLOSED', examMode: 'QUIZ', maxAttempts: 1,
      },
      {
        // The window is the duration plus the 10-minute grace period for late entry.
        kind: 'midterm', questions: byLesson.flatMap((list) => list.slice(0, 2)), durationMinutes: 60, startAt: plus(midtermEnd, -70 * MIN), endAt: midtermEnd,
        description: 'Proctored midterm covering all three modules. One descriptive question is graded by the teacher.', status: 'CLOSED', examMode: 'MIDTERM',
        maxAttempts: 1, shuffleQuestions: true, randomOptionOrder: true, showResultImmediately: false, gracePeriodMinutes: 10,
      },
      {
        kind: 'practice', questions: [...lastModule, ...autoGraded.slice(0, 3).map((list) => list[list.length - 1])], durationMinutes: 40,
        startAt: ago(2 * DAY + ci * 3 * HOUR), endAt: ahead(5 * DAY + ci * 2 * HOUR),
        description: `Practice test on ${modulesCovered(2, 3)}, with a few revision questions. Not counted in the grade.`, status: 'PUBLISHED', examMode: 'PRACTICE', maxAttempts: 3,
      },
      {
        kind: 'quiz2', questions: lastModule.slice(0, 8), durationMinutes: 20, startAt: quiz2Start, endAt: plus(quiz2Start, DAY),
        description: `Quiz on ${modulesCovered(2, 3)}.`, status: 'PUBLISHED', examMode: 'QUIZ', maxAttempts: 1,
      },
      {
        kind: 'final', questions: roundRobin(byLesson, 20), durationMinutes: 120, startAt: null, endAt: null,
        description: 'Draft of the end-semester paper. Dates are set once the timetable is approved.', status: 'DRAFT', examMode: 'FINAL',
        maxAttempts: 1, shuffleQuestions: true, randomOptionOrder: true, showResultImmediately: false, gracePeriodMinutes: 10,
      },
    ];

    for (const { kind, questions: picked, durationMinutes, startAt, endAt, ...settings } of plan) {
      const totalMarks = picked.reduce((s, q) => s + q.marks, 0);
      const row: TestRow = {
        id: newId(), kind, courseCode: course.code, title: testTitle[kind](course.code), questions: picked,
        totalMarks, passingMarks: Math.ceil(totalMarks * PASS_FRACTION), durationMinutes, startAt, endAt,
      };
      testRows.push(row);
      const createdAt = startAt ? plus(startAt, -6 * DAY) : ago(3 * DAY);
      tests.push({
        id: row.id, title: row.title, courseId: courseId[course.code], durationMinutes, totalMarks, passingMarks: row.passingMarks,
        negativeMarks: NEGATIVE_MARKS, startAt, endAt, createdById: staffBy(course.teacher).id, createdAt, ...settings,
      });
      picked.forEach((q, orderIndex) => testQuestions.push({ testId: row.id, questionId: q.id, orderIndex }));
      if (settings.status !== 'DRAFT') {
        for (const classId of classIds[course.code]) testAssignments.push({ testId: row.id, classId, assignedAt: createdAt, dueAt: endAt });
      }
    }
  });
  await prisma.test.createMany({ data: tests });
  await prisma.testQuestion.createMany({ data: testQuestions });
  await prisma.testAssignment.createMany({ data: testAssignments });

  /* --------------------------------------------------------- attempts */

  const attempts: AttemptRow[] = [];
  const testOf = (code: string, kind: TestKind): TestRow => {
    const found = testRows.find((t) => t.courseCode === code && t.kind === kind);
    if (!found) throw new Error(`No ${kind} test for ${code}`);
    return found;
  };

  for (const course of COURSES) {
    const members = enrolled(course);
    const windowOf = (test: TestRow): [Date, Date] => {
      if (!test.startAt || !test.endAt) throw new Error(`${test.title} has no window`);
      return [test.startAt, test.endAt];
    };

    // (a) Closed quiz: every enrolled student, started early enough in the 24-hour window to finish inside it.
    const quiz = testOf(course.code, 'quiz1');
    const [quizOpens, quizCloses] = windowOf(quiz);
    for (const s of members) {
      attempts.push(finishedAttempt(stream(`attempt/${quiz.title}/${s.username}`), s, quiz, quizOpens, plus(quizCloses, -quiz.durationMinutes * MIN)));
    }

    // (b) Closed midterm: about 90 percent sat it, all starting inside the grace period; proctored.
    const midterm = testOf(course.code, 'midterm');
    const sat = members.filter((s) => s.primary || chance(stream(`sat/${midterm.title}/${s.username}`), 0.9));
    const flagRng = stream(`flagged/${midterm.title}`);
    const candidates = sat.filter((s) => !s.primary);
    const flagged = new Set<string>();
    while (flagged.size < Math.min(2, candidates.length)) flagged.add(pick(flagRng, candidates).id);
    for (const s of sat) {
      const r = stream(`attempt/${midterm.title}/${s.username}`);
      const [opens] = windowOf(midterm);
      const attempt = finishedAttempt(r, s, midterm, opens, plus(opens, 9 * MIN));
      proctor(r, attempt, flagged.has(s.id));
      attempts.push(attempt);
    }

    // (c) Open practice test: about 40 percent so far, and never the primary student.
    const practice = testOf(course.code, 'practice');
    const [practiceOpens] = windowOf(practice);
    const waiting: Student[] = [];
    for (const s of members.filter((m) => !m.primary)) {
      if (chance(stream(`sat/${practice.title}/${s.username}`), 0.4)) {
        attempts.push(finishedAttempt(stream(`attempt/${practice.title}/${s.username}`), s, practice, practiceOpens, ago((practice.durationMinutes + 10) * MIN)));
      } else {
        waiting.push(s);
      }
    }

    // One student is in the middle of the first course's practice test right now.
    if (course === COURSES[0] && waiting.length) {
      const s = waiting[0];
      const r = stream(`in-progress/${practice.title}`);
      const answers = answerQuestions(r, s, practice.questions.slice(0, 4)).map((a): AnswerRow => ({ ...a, isCorrect: null, marks: null }));
      attempts.push({
        id: newId(), student: s, test: practice, startedAt: ago(9 * MIN), submittedAt: null, inProgress: true,
        score: null, percentage: null, passed: null, timeTaken: null, answers, events: [], suspicionScore: 0,
      });
    }
  }

  await prisma.attempt.createMany({
    data: attempts.map((a): Prisma.AttemptCreateManyInput => ({
      id: a.id, studentId: a.student.id, testId: a.test.id, startedAt: a.startedAt, submittedAt: a.submittedAt,
      status: a.inProgress ? 'IN_PROGRESS' : 'EVALUATED', score: a.score, percentage: a.percentage, passed: a.passed,
      timeTakenSeconds: a.timeTaken, suspicionScore: a.suspicionScore,
      // What the exam page reports itself; the proctor's alert is not one of those.
      suspiciousEvents: a.events.filter((e) => e.type !== 'ALERT_SENT').map((e) => ({ type: e.type, details: {}, at: e.at.toISOString() })),
    })),
  });
  await prisma.attemptAnswer.createMany({
    data: attempts.flatMap((a) => a.answers.map((ans): Prisma.AttemptAnswerCreateManyInput => ({
      id: newId(), attemptId: a.id, questionId: ans.questionId, optionId: ans.optionId, answerJson: ans.answerJson,
      isCorrect: ans.isCorrect, marksObtained: ans.marks, timeSpentSeconds: ans.timeSpent,
    }))),
  });

  // Proctoring sessions for the midterm attempts.
  const sessions: Prisma.ProctoringSessionCreateManyInput[] = [];
  const events: Prisma.ProctoringEventCreateManyInput[] = [];
  const noteRng = stream('proctor-notes');
  const reviewNotes = [
    'Repeated paste events and tab switches. Student alerted during the test. Referred to the Examination Cell under regulation 5.',
    'Left full-screen several times and pasted text into answers. Alert sent; pattern continued. Marked for review.',
    'High number of focus losses with copy and paste activity. Recommend a Level 2 review of this attempt.',
  ];
  for (const a of attempts.filter((x) => x.test.kind === 'midterm')) {
    const sessionId = newId();
    sessions.push({
      id: sessionId, attemptId: a.id, testId: a.test.id, studentId: a.student.id, proctorId: proctorUser.id,
      startedAt: a.startedAt, endedAt: a.submittedAt, status: 'ENDED', suspicionScore: a.suspicionScore,
      notes: a.suspicionScore >= 50 ? pick(noteRng, reviewNotes) : null,
    });
    for (const e of a.events) events.push({ sessionId, type: e.type, severity: e.severity, message: e.message, createdAt: e.at });
  }
  await prisma.proctoringSession.createMany({ data: sessions });
  await prisma.proctoringEvent.createMany({ data: events });

  /* ----------------------------------------------- question analytics */

  // Same arithmetic as recalculateQuestionAnalytics in questionAnalytics.service.ts.
  const answersOf = new Map<string, { answer: AnswerRow; attempt: AttemptRow }[]>();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const list = answersOf.get(answer.questionId) ?? [];
      list.push({ answer, attempt });
      answersOf.set(answer.questionId, list);
    }
  }
  await prisma.questionAnalytics.createMany({
    data: Object.values(questionRows).flat().map((q): Prisma.QuestionAnalyticsCreateManyInput => {
      const all = answersOf.get(q.id) ?? [];
      const judged = all.filter((x) => x.answer.isCorrect !== null);
      const correctCount = judged.filter((x) => x.answer.isCorrect === true).length;
      const attemptCount = judged.length;
      let discriminationIndex = 0;
      if (attemptCount >= 6) {
        const perStudent = new Map<string, { correct: boolean; score: number }>();
        for (const { answer, attempt } of all) {
          const entry = perStudent.get(attempt.student.id) ?? { correct: false, score: 0 };
          if (answer.isCorrect === true) entry.correct = true;
          if (attempt.score !== null) entry.score = attempt.score;
          perStudent.set(attempt.student.id, entry);
        }
        const ranked = [...perStudent.values()].sort((x, y) => y.score - x.score);
        const third = Math.floor(ranked.length / 3);
        if (ranked.length >= 6 && third > 0) {
          const hits = (group: typeof ranked) => group.filter((x) => x.correct).length;
          discriminationIndex = round2((hits(ranked.slice(0, third)) - hits(ranked.slice(-third))) / third);
        }
      }
      return {
        questionId: q.id, attemptCount, correctCount, incorrectCount: attemptCount - correctCount,
        accuracy: attemptCount ? Math.round((correctCount / attemptCount) * 10000) / 100 : 0,
        avgTimeSeconds: attemptCount ? round2(judged.reduce((s, x) => s + x.answer.timeSpent, 0) / attemptCount) : 0,
        discriminationIndex,
      };
    }),
  });

  /* ------------------------------------- leaderboards and certificates */

  // What recalculateLeaderboard intends per course: passed, evaluated attempts only, ranked by total score.
  const leaderboard: Prisma.LeaderboardCreateManyInput[] = [];
  for (const course of COURSES) {
    const stats = new Map<string, { total: number; percentages: number[] }>();
    for (const a of attempts) {
      if (a.test.courseCode !== course.code || a.inProgress || a.score === null || a.percentage === null || !a.passed) continue;
      const entry = stats.get(a.student.id) ?? { total: 0, percentages: [] };
      entry.total += a.score;
      entry.percentages.push(a.percentage);
      stats.set(a.student.id, entry);
    }
    const ranked = [...stats.entries()]
      .map(([userId, s]) => ({ userId, total: round2(s.total), tests: s.percentages.length, avg: s.percentages.reduce((x, y) => x + y, 0) / s.percentages.length }))
      .sort((x, y) => y.total - x.total || y.avg - x.avg || x.userId.localeCompare(y.userId));
    ranked.forEach((e, i) => leaderboard.push({
      userId: e.userId, courseId: courseId[course.code], totalScore: e.total, testsTaken: e.tests, avgPercentage: e.avg, rank: i + 1,
    }));
  }
  await prisma.leaderboard.createMany({ data: leaderboard });

  // Merit certificates: the top three midterm scores of each course, plus the primary student's DSA midterm.
  const certRng = stream('certificates');
  const code = (alphabet: string, length: number): string => Array.from({ length }, () => alphabet[Math.floor(certRng() * alphabet.length)]).join('');
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
  const certificates: Prisma.CertificateCreateManyInput[] = [];
  for (const course of COURSES) {
    const midterm = testOf(course.code, 'midterm');
    const passedAttempts = attempts.filter((a) => a.test === midterm && a.passed).sort((x, y) => (y.score ?? 0) - (x.score ?? 0) || x.id.localeCompare(y.id));
    const winners = passedAttempts.slice(0, 3);
    const own = passedAttempts.find((a) => a.student.primary);
    if (course.code === 'CS201' && own && !winners.includes(own)) winners.push(own);
    for (const a of winners) {
      // Same shape as generateCredentialId in certificate.service.ts.
      const credentialId = `CERT-${code('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8)}-${code('0123456789ABCDEF', 8)}`;
      certificates.push({
        userId: a.student.id, courseId: courseId[course.code], attemptId: a.id, title: `${course.name}: Midterm Merit Certificate`,
        description: `Awarded for scoring ${a.percentage} percent in the ${midterm.title}.`,
        issuedAt: plus(midterm.endAt ?? NOW, DAY), credentialId, status: 'ACTIVE', qrData: `${frontendUrl}/verify/${credentialId}`,
      });
    }
  }
  await prisma.certificate.createMany({ data: certificates });

  /* --------------------------------------------------------- progress */

  const progressRng = stream('progress');
  const lessonProgress: Prisma.LessonProgressCreateManyInput[] = [];
  const courseProgress: Prisma.CourseProgressCreateManyInput[] = [];
  const completedBy = new Map<string, number>(); // `${studentId}/${courseCode}` -> lessons completed
  for (const course of COURSES) {
    for (const s of enrolled(course)) {
      const done = s.primary
        ? PRIMARY_STUDENT.lessonsCompleted[course.code]
        : clamp(Math.round(9 * (0.25 + s.ability * 0.75 + between(progressRng, -0.15, 0.15))), 0, 9);
      completedBy.set(`${s.id}/${course.code}`, done);
      let last = ago(99 * DAY);
      for (let i = 0; i < done; i += 1) {
        last = ago((92 - i * 9 - between(progressRng, 0, 5)) * DAY);
        lessonProgress.push({ userId: s.id, lessonId: lessonIds[course.code][i], completed: true, completedAt: last });
      }
      courseProgress.push({
        userId: s.id, courseId: courseId[course.code], completedLessons: done, totalLessons: 9,
        percentage: Math.round((done / 9) * 10000) / 100, lastAccessedAt: s.primary ? ago(between(progressRng, 2 * HOUR, 30 * HOUR)) : last,
      });
    }
  }
  await prisma.lessonProgress.createMany({ data: lessonProgress });
  await prisma.courseProgress.createMany({ data: courseProgress });

  /* ------------------------- announcements, ratings and discussions */

  await prisma.courseAnnouncement.createMany({
    data: COURSES.flatMap((c) => ANNOUNCEMENTS[c.code].map((a) => ({
      courseId: courseId[c.code], authorId: staffBy(c.teacher).id, title: a.title, message: a.message, pinned: a.pinned, createdAt: ago(a.daysAgo * DAY),
    }))),
  });

  const ratingRng = stream('ratings');
  const ratings: Prisma.CourseRatingCreateManyInput[] = [];
  for (const course of COURSES) {
    for (const s of enrolled(course)) {
      const favourite = s.primary && (course.code === 'CS201' || course.code === 'CS301');
      if (!favourite && ((completedBy.get(`${s.id}/${course.code}`) ?? 0) < 4 || s.primary || !chance(ratingRng, 0.6))) continue;
      const roll = ratingRng();
      const rating = favourite ? 5 : roll < 0.45 ? 5 : roll < 0.85 ? 4 : roll < 0.97 ? 3 : 2;
      ratings.push({
        courseId: courseId[course.code], userId: s.id, rating, review: favourite || chance(ratingRng, 0.7) ? pick(ratingRng, REVIEWS[rating]) : null,
        createdAt: ago(between(ratingRng, 2 * DAY, 30 * DAY)),
      });
    }
  }
  await prisma.courseRating.createMany({ data: ratings });

  const discussionRng = stream('discussions');
  const discussions: Prisma.CourseDiscussionCreateManyInput[] = [];
  for (const course of COURSES) {
    DISCUSSIONS[course.code].forEach((thread, ti) => {
      // The primary student asks about the topics he is weak in.
      const weakCourse = course.code === 'CS302' || course.code === 'CS303';
      const asker = ti === 0 && weakCourse ? primary : pick(discussionRng, enrolled(course).filter((s) => !s.primary));
      const rootId = newId();
      let at = ago((12 - ti * 5) * DAY - between(discussionRng, 0, 8) * HOUR);
      discussions.push({ id: rootId, courseId: courseId[course.code], authorId: asker.id, content: thread.question, createdAt: at });
      for (const reply of thread.replies) {
        at = plus(at, between(discussionRng, 0.5, 7) * HOUR);
        discussions.push({
          id: newId(), courseId: courseId[course.code], parentId: rootId, content: reply.content, createdAt: at,
          authorId: reply.by === 'teacher' ? staffBy(course.teacher).id : asker.id,
        });
      }
    });
  }
  // One statement would insert replies alongside their parents; the self-reference needs parents first.
  await prisma.courseDiscussion.createMany({ data: discussions.filter((d) => !d.parentId) });
  await prisma.courseDiscussion.createMany({ data: discussions.filter((d) => d.parentId) });

  /* ------------------------------------------------------ assignments */

  const workRng = stream('assignments');
  const assignments: Prisma.AssignmentCreateManyInput[] = [];
  const submissions: Prisma.AssignmentSubmissionCreateManyInput[] = [];
  const comments = ['Report and source code attached.', 'Submitting the PDF report; the code is in the appendix.', 'Attached. The last part is incomplete, I ran out of time.', null];
  for (const course of COURSES) {
    ASSIGNMENTS[course.code].forEach((a, ai) => {
      const id = newId();
      const closed = a.dueInDays < 0;
      const dueAt = ahead(a.dueInDays * DAY);
      assignments.push({
        id, title: a.title, description: a.description, courseId: courseId[course.code], maxMarks: a.maxMarks, dueAt,
        createdById: staffBy(course.teacher).id, createdAt: plus(dueAt, -14 * DAY),
      });
      for (const s of enrolled(course)) {
        // Closed: most submitted and most of those are graded. Open: a third so far, none graded.
        const submits = s.primary ? closed || course.code === 'CS201' : chance(workRng, closed ? 0.5 + s.ability * 0.45 : 0.33);
        if (!submits) continue;
        const graded = closed && (s.primary || chance(workRng, 0.7));
        const fraction = clamp(s.ability + between(workRng, -0.12, 0.15), 0.25, 1);
        submissions.push({
          assignmentId: id, studentId: s.id,
          fileUrl: `https://files.${EMAIL_DOMAIN}/submissions/${course.code.toLowerCase()}-a${ai + 1}/${s.username}.pdf`,
          answerText: s.primary ? a.sampleAnswer : pick(workRng, comments),
          marks: graded ? Math.round(a.maxMarks * fraction * 2) / 2 : null,
          feedback: graded ? pick(workRng, FEEDBACK.find((f) => fraction >= f.min)?.text ?? FEEDBACK[FEEDBACK.length - 1].text) : null,
          submittedAt: closed ? plus(dueAt, -between(workRng, 2 * HOUR, 6 * DAY)) : ago(between(workRng, 2 * HOUR, 3 * DAY)),
        });
      }
    });
  }
  await prisma.assignment.createMany({ data: assignments });
  await prisma.assignmentSubmission.createMany({ data: submissions });

  /* ------------------------------------------------- coding problems */

  const codingRng = stream('coding');
  const dsa = COURSES.find((c) => c.code === 'CS201') ?? COURSES[0];
  const problemId: Record<string, string> = {};
  const testCases: Prisma.CodingTestCaseCreateManyInput[] = [];
  await prisma.codingProblem.createMany({
    data: CODING_PROBLEMS.map((p, pi): Prisma.CodingProblemCreateManyInput => {
      problemId[p.key] = newId();
      p.cases.forEach(([input, expectedOutput], orderIndex) => testCases.push({ problemId: problemId[p.key], input, expectedOutput, isPublic: orderIndex < 2, orderIndex }));
      return {
        id: problemId[p.key], title: p.title, description: p.description, courseId: courseId[dsa.code], difficulty: p.difficulty,
        timeLimitMs: 2000, memoryLimitMB: 256,
        // codingProblem.service.ts stores this column as a JSON-encoded string and JSON.parse()s it on read.
        allowedLanguages: JSON.stringify(['python', 'javascript', 'java']),
        solution: p.solution, createdById: staffBy(dsa.teacher).id, createdAt: ago((60 - pi * 6) * DAY),
      };
    }),
  });
  await prisma.codingTestCase.createMany({ data: testCases });
  await prisma.codeSubmission.createMany({
    data: CODE_SUBMISSIONS.map((sub): Prisma.CodeSubmissionCreateManyInput => {
      const problem = CODING_PROBLEMS.find((p) => p.key === sub.problem);
      if (!problem) throw new Error(`Unknown coding problem "${sub.problem}"`);
      // The result object executeCode() persists; a compile error runs no test case.
      const results = sub.status === 'ERROR' ? [] : problem.cases.map(([, expected], i) => {
        const actual = sub.status === 'ACCEPTED' ? expected : sub.actual?.[i] ?? '';
        return { passed: actual === expected, expected, actual, runtimeMs: intBetween(codingRng, 18, 64) };
      });
      const executionTime = results.reduce((s, x) => s + x.runtimeMs, 0);
      const passedCount = results.filter((x) => x.passed).length;
      return {
        problemId: problemId[sub.problem], userId: studentBy(sub.by).id, language: sub.language, code: sub.code ?? problem.solution,
        status: sub.status, executionTime, createdAt: ago(sub.hoursAgo * HOUR),
        result: { status: sub.status, results, passedCount, totalCount: results.length, executionTime, ...(sub.error ? { error: sub.error } : {}) },
      };
    }),
  });

  /* ------------------------------------------------------- placements */

  const placementRng = stream('placements');
  const branchOf = (dept: DeptCode): string => DEPARTMENTS.find((d) => d.code === dept)?.branch ?? dept;
  const profiles = students.map((s, i) => {
    const own = s.primary ? PRIMARY_STUDENT.placement : null;
    const cgpa = own?.cgpa ?? round2(clamp(5.7 + s.ability * 4 + between(placementRng, -0.35, 0.35), 5.5, 9.85));
    return {
      student: s,
      branch: branchOf(s.dept),
      cgpa,
      tenthPercentage: own?.tenthPercentage ?? Math.round(clamp(58 + s.ability * 38 + between(placementRng, -5, 5), 55, 98.5) * 10) / 10,
      twelfthPercentage: own?.twelfthPercentage ?? Math.round(clamp(55 + s.ability * 38 + between(placementRng, -6, 6), 52, 97.5) * 10) / 10,
      activeBacklogs: own?.activeBacklogs ?? (s.ability < 0.45 ? intBetween(placementRng, 0, 2) : s.ability < 0.55 && chance(placementRng, 0.3) ? 1 : 0),
      skills: own?.skills ?? shuffled(placementRng, SKILLS[s.dept]).slice(0, intBetween(placementRng, 4, 6)),
      // +91 55501 numbers are not assignable Indian mobile numbers (those start with 6 to 9).
      phone: `+91 55501 ${String(100 + i).padStart(5, '0')}`,
      verified: s.primary || chance(placementRng, 0.85),
    };
  });
  await prisma.placementProfile.createMany({
    data: profiles.map((p): Prisma.PlacementProfileCreateManyInput => ({
      userId: p.student.id, fullName: p.student.fullName, rollNumber: p.student.rollNumber, phone: p.phone, branch: p.branch, cgpa: p.cgpa,
      tenthPercentage: p.tenthPercentage, twelfthPercentage: p.twelfthPercentage, skills: p.skills, activeBacklogs: p.activeBacklogs,
      graduationYear: PLACEMENT_BATCH_YEAR,
      resumeUrl: `https://files.${EMAIL_DOMAIN}/resumes/${p.student.username}.pdf`,
      githubUrl: `https://git.${EMAIL_DOMAIN}/${p.student.username}`,
      linkedinUrl: `https://alumni.${EMAIL_DOMAIN}/in/${p.student.username.replace(/_/g, '-')}`,
      isVerified: p.verified, verifiedAt: p.verified ? ago(50 * DAY) : null, verifiedBy: p.verified ? officer.id : null,
    })),
  });

  const driveId: Record<string, string> = {};
  await prisma.placementDrive.createMany({
    data: DRIVES.map((d): Prisma.PlacementDriveCreateManyInput => {
      driveId[d.key] = newId();
      return {
        id: driveId[d.key], companyName: d.companyName, role: d.role, description: d.description, driveType: d.driveType,
        eligibilityCgpa: d.eligibilityCgpa, eligibleBranches: d.eligibleBranches, maxBacklogs: d.maxBacklogs,
        minTenthPercent: d.minTenthPercent, minTwelfthPercent: d.minTwelfthPercent, batchYear: PLACEMENT_BATCH_YEAR, ctcLpa: d.ctcLpa,
        location: d.location, deadline: istEndOfDay(d.deadlineInDays), driveDate: istMorning(d.driveInDays), status: d.status,
        selectionProcess: d.selectionProcess, createdById: d.createdBy === 'admin' ? admin.id : officer.id,
        createdAt: ago(Math.max(9, 20 - d.deadlineInDays) * DAY),
      };
    }),
  });

  const eligible = (p: (typeof profiles)[number], d: SeedDrive): boolean =>
    p.cgpa >= d.eligibilityCgpa
    && (d.eligibleBranches.length === 0 || d.eligibleBranches.includes(p.branch))
    && p.activeBacklogs <= d.maxBacklogs
    && p.tenthPercentage >= (d.minTenthPercent ?? 0)
    && p.twelfthPercentage >= (d.minTwelfthPercent ?? 0);

  const applications: Prisma.PlacementApplicationCreateManyInput[] = [];
  for (const d of DRIVES) {
    // Nobody could apply to a drive that has not opened or was cancelled.
    if (d.status === 'UPCOMING' || d.status === 'CANCELLED') continue;
    for (const p of profiles) {
      const fixed = p.student.primary ? PRIMARY_APPLICATIONS.find(([key]) => key === d.key) : undefined;
      if (p.student.primary ? !fixed : !eligible(p, d) || !chance(placementRng, 0.55)) continue;
      const roll = placementRng();
      const status = fixed?.[1]
        ?? (d.status === 'COMPLETED' ? (roll < 0.15 + p.student.ability * 0.4 ? 'SELECTED' : 'REJECTED')
          : roll < 0.5 ? 'APPLIED' : roll < 0.78 ? 'SHORTLISTED' : roll < 0.94 ? 'INTERVIEWED' : 'REJECTED');
      const progress = APPLICATION_PROGRESS[status];
      // A few online assessments were flagged by the proctor, one of them disqualified.
      const verdict = !fixed && status === 'SHORTLISTED' && chance(placementRng, 0.15) ? 'FLAGGED'
        : !fixed && status === 'REJECTED' && d.status === 'ACTIVE' && chance(placementRng, 0.4) ? 'DISQUALIFIED'
          : progress.proctorStatus;
      const appliedAt = plus(istEndOfDay(d.deadlineInDays), -between(placementRng, 1, 9) * DAY);
      applications.push({
        driveId: driveId[d.key], studentId: p.student.id, status,
        currentRound: verdict === 'DISQUALIFIED' ? 'Disqualified (Malpractice)' : progress.currentRound,
        assessmentScore: progress.scored ? Math.round(clamp(48 + p.student.ability * 48 + between(placementRng, -6, 6), 35, 99) * 2) / 2 : null,
        proctorStatus: verdict,
        proctorNotes: verdict === 'FLAGGED' ? 'Second face detected twice during the assessment; under review.'
          : verdict === 'DISQUALIFIED' ? 'Switched to another window repeatedly and pasted code. Disqualified after review.' : null,
        notes: fixed ? fixed[2] : pick(placementRng, APPLICATION_NOTES[status]),
        appliedAt: appliedAt < NOW ? appliedAt : ago(between(placementRng, 1, 6) * DAY),
      });
    }
  }
  await prisma.placementApplication.createMany({ data: applications });

  /* ------------------------ notifications, sign-in history, audit log */

  const demoAccounts: Person[] = [admin, staffBy('orgadmin'), proctorUser, staffBy('teacher'), primary];
  const accountBy = (username: string): Person => {
    const found = demoAccounts.find((a) => a.username === username);
    if (!found) throw new Error(`"${username}" is not a demo account`);
    return found;
  };
  await prisma.notification.createMany({
    data: Object.entries(NOTIFICATIONS).flatMap(([username, items]) => items.map((n) => ({
      userId: accountBy(username).id, type: n.type, title: n.title, message: n.message, isRead: n.isRead, createdAt: ago(n.daysAgo * DAY),
    }))),
  });

  // 203.0.113.0/24 and 198.51.100.0/24 are reserved for documentation.
  const activityRng = stream('activity');
  const address = (r: Rng): string => `${pick(r, ['203.0.113', '198.51.100'])}.${intBetween(r, 2, 250)}`;
  const logins: Prisma.LoginHistoryCreateManyInput[] = [];
  const audit: Prisma.AuditLogCreateManyInput[] = [];
  const log = (user: Person, action: string, at: Date, entity = 'User', entityId: string | null = user.id, metadata?: Prisma.InputJsonObject) =>
    audit.push({ userId: user.id, action, entity, entityId, metadata, ip: address(activityRng), userAgent: pick(activityRng, USER_AGENTS), createdAt: at });

  for (const account of demoAccounts) {
    const ip = address(activityRng);
    const userAgent = pick(activityRng, USER_AGENTS);
    const times = Array.from({ length: 5 }, (_, i) => ago(between(activityRng, i * 2 * DAY + HOUR, (i + 1) * 2 * DAY)));
    times.forEach((at, i) => {
      logins.push({ userId: account.id, ip, userAgent, success: true, createdAt: at });
      if (i < 3) log(account, 'LOGIN', at);
    });
    // One mistyped password just before a successful sign-in.
    logins.push({ userId: account.id, ip, userAgent, success: false, reason: 'bad_password', createdAt: plus(times[2], -40_000) });
    log(account, 'LOGOUT', plus(times[1], between(activityRng, 20, 90) * MIN));
    await prisma.user.update({ where: { id: account.id }, data: { lastLoginAt: times[0] } });
  }
  for (const s of students.slice(1, 9)) log(admin, 'USER_CREATED', ago(104 * DAY - between(activityRng, 0, 40) * MIN), 'User', s.id, { role: 'STUDENT' });
  log(admin, 'ROLE_CHANGED', ago(60 * DAY), 'User', proctorUser.id, { from: 'TEACHER', to: 'PROCTOR' });
  log(admin, 'ROLE_CHANGED', ago(118 * DAY), 'User', staffBy('orgadmin').id, { from: 'TEACHER', to: 'ORG_ADMIN' });
  for (const account of [primary, staffBy('teacher'), proctorUser]) log(account, 'PASSWORD_CHANGED', ago(between(activityRng, 20, 70) * DAY));
  for (const username of ['teacher', 'rohit_deshpande']) log(staffBy(username), 'TEST_DELETED', ago(between(activityRng, 25, 45) * DAY), 'Test', newId());
  for (const account of [primary, admin]) log(account, 'SESSION_REVOKED', ago(between(activityRng, 3, 15) * DAY));
  for (const username of ['meera_pillai', PLACEMENT_OFFICER]) log(staffBy(username), 'LOGIN', ago(between(activityRng, 1, 4) * DAY));
  const locked = students[students.length - 1];
  log(locked, 'ACCOUNT_LOCKED', ago(14 * HOUR), 'User', locked.id, { failureCount: 5, reason: 'bad_password' });
  await prisma.loginHistory.createMany({ data: logins });
  await prisma.auditLog.createMany({ data: audit });

  /* ---------------------------------------------------------- summary */

  const counts = {
    Organization: await prisma.organization.count(),
    Department: await prisma.department.count(),
    Batch: await prisma.batch.count(),
    User: await prisma.user.count(),
    Course: await prisma.course.count(),
    Module: await prisma.module.count(),
    Lesson: await prisma.lesson.count(),
    Enrollment: await prisma.enrollment.count(),
    ClassBatch: await prisma.classBatch.count(),
    ClassStudent: await prisma.classStudent.count(),
    LessonProgress: await prisma.lessonProgress.count(),
    CourseProgress: await prisma.courseProgress.count(),
    Question: await prisma.question.count(),
    QuestionOption: await prisma.questionOption.count(),
    QuestionBank: await prisma.questionBank.count(),
    Test: await prisma.test.count(),
    TestQuestion: await prisma.testQuestion.count(),
    TestAssignment: await prisma.testAssignment.count(),
    Attempt: await prisma.attempt.count(),
    AttemptAnswer: await prisma.attemptAnswer.count(),
    QuestionAnalytics: await prisma.questionAnalytics.count(),
    Leaderboard: await prisma.leaderboard.count(),
    Certificate: await prisma.certificate.count(),
    ProctoringSession: await prisma.proctoringSession.count(),
    ProctoringEvent: await prisma.proctoringEvent.count(),
    CourseAnnouncement: await prisma.courseAnnouncement.count(),
    CourseRating: await prisma.courseRating.count(),
    CourseDiscussion: await prisma.courseDiscussion.count(),
    Assignment: await prisma.assignment.count(),
    AssignmentSubmission: await prisma.assignmentSubmission.count(),
    CodingProblem: await prisma.codingProblem.count(),
    CodingTestCase: await prisma.codingTestCase.count(),
    CodeSubmission: await prisma.codeSubmission.count(),
    PlacementProfile: await prisma.placementProfile.count(),
    PlacementDrive: await prisma.placementDrive.count(),
    PlacementApplication: await prisma.placementApplication.count(),
    Notification: await prisma.notification.count(),
    AuditLog: await prisma.auditLog.count(),
    LoginHistory: await prisma.loginHistory.count(),
  };
  console.log('\nSeed complete: Meridian Institute of Technology');
  console.table(Object.entries(counts).map(([table, rows]) => ({ table, rows })));
  console.log(`Demo logins (password for every account: ${DEMO_PASSWORD})`);
  for (const account of demoAccounts) {
    const role = account === primary ? 'STUDENT' : STAFF.find((s) => s.username === account.username)?.role;
    console.log(`  ${account.email.padEnd(28)} ${String(role).padEnd(10)} ${account.fullName}`);
  }
  console.log(`  Other teachers: ${staff.filter((s) => s.role === 'TEACHER' && s.username !== 'teacher').map((s) => s.email).join(', ')}`);
  console.log(`  Other students: 35 more, for example ${students[1].email}`);

  // Fill the knowledge base the AI assistant answers from: every lesson plus the institute documents.
  // Imported here, not at the top, so the content check above runs without loading the app config.
  const knowledge = await import('../src/ai/knowledge.service.js');
  const lessonIndex = await knowledge.syncLessons();
  for (const doc of INSTITUTE_DOCUMENTS) {
    await knowledge.addDocument({ id: admin.id, role: 'ADMIN' }, { title: doc.title, text: doc.text });
  }
  console.log(`Knowledge base: ${lessonIndex.indexed} lessons and ${INSTITUTE_DOCUMENTS.length} institute documents indexed`);
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
