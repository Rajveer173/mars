// Read-only self-check for a seeded database. Not content: run it after the seed.
//
//   npx tsx prisma/seed-data/verify.ts
//
// It re-grades every stored answer with the rules of evaluation.service.ts,
// rebuilds the derived tables from the attempts, and exits non-zero on any
// mismatch. The fingerprint line is identical for two runs of the seed.
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { DEMO_PASSWORD, EMAIL_DOMAIN, PRIMARY_STUDENT } from './people.js';

const prisma = new PrismaClient();
const failures: string[] = [];
const check = (ok: boolean, message: string): void => {
  if (!ok) failures.push(message);
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.005;
const normalise = (v: string): string => v.trim().toLowerCase().replace(/\s+/g, ' ');
const words = (text: string): number => text.split(/\s+/).filter((t) => /[A-Za-z0-9]/.test(t)).length;

async function main(): Promise<void> {
  const [attempts, questions, tests, lessons, leaderboard, analytics, enrolments, sessions] = await Promise.all([
    prisma.attempt.findMany({ include: { answers: true, student: { select: { email: true } } } }),
    prisma.question.findMany({ include: { options: true } }),
    prisma.test.findMany({ include: { course: { select: { id: true, code: true } }, testQuestions: true } }),
    prisma.lesson.findMany({ select: { title: true, content: true } }),
    prisma.leaderboard.findMany(),
    prisma.questionAnalytics.findMany(),
    prisma.enrollment.findMany({ include: { user: { select: { email: true } } } }),
    prisma.proctoringSession.findMany({ include: { events: true } }),
  ]);
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const testById = new Map(tests.map((t) => [t.id, t]));
  const primaryEmail = `${PRIMARY_STUDENT.username}@${EMAIL_DOMAIN}`;

  /* 1. Every answer re-graded; every attempt total recomputed. */
  let regraded = 0;
  for (const attempt of attempts) {
    const test = testById.get(attempt.testId);
    if (!test) throw new Error('attempt without test');
    const inTest = new Set(test.testQuestions.map((tq) => tq.questionId));
    const label = `${attempt.student.email} / ${test.title}`;

    if (attempt.status === 'IN_PROGRESS') {
      check(attempt.score === null && attempt.submittedAt === null, `${label}: in-progress attempt has a score or a submit time`);
      check(attempt.answers.every((a) => a.isCorrect === null && a.marksObtained === null), `${label}: in-progress answers are graded`);
      continue;
    }

    let sum = 0;
    let manual = false;
    for (const answer of attempt.answers) {
      const q = questionById.get(answer.questionId);
      if (!q) throw new Error('answer without question');
      check(inTest.has(q.id), `${label}: answer to a question that is not in the test`);
      const json = answer.answerJson as { optionIds?: string[]; text?: string } | null;
      const marks = Number(q.marks);
      const negative = Number(q.negativeMarks);
      let expected: { marks: number; isCorrect: boolean | null };
      if (answer.optionId == null && json == null) expected = { marks: 0, isCorrect: null };
      else if (q.type === 'SINGLE' || q.type === 'TRUE_FALSE') {
        expected = q.options.find((o) => o.id === answer.optionId)?.isCorrect ? { marks, isCorrect: true } : { marks: -negative, isCorrect: false };
      } else if (q.type === 'MULTIPLE') {
        const selected = new Set(json?.optionIds ?? []);
        const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id);
        const exact = correct.length === selected.size && correct.every((id) => selected.has(id));
        expected = exact ? { marks, isCorrect: true } : { marks: -negative, isCorrect: false };
      } else if (q.type === 'FILL_BLANK') {
        const accepted = (q.correctAnswer as string[]).map(normalise);
        const given = normalise(String(json?.text ?? ''));
        expected = given && accepted.includes(given) ? { marks, isCorrect: true } : { marks: -negative, isCorrect: false };
      } else {
        // Descriptive: either still ungraded (0, null) or graded by hand (isCorrect true, 0..marks).
        const got = Number(answer.marksObtained);
        const ungraded = answer.isCorrect === null && got === 0;
        const graded = answer.isCorrect === true && got >= 0 && got <= marks;
        check(ungraded || graded, `${label}: descriptive answer in an impossible state`);
        if (graded) manual = true;
        expected = { marks: got, isCorrect: answer.isCorrect };
      }
      check(answer.isCorrect === expected.isCorrect && near(Number(answer.marksObtained), expected.marks),
        `${label}: stored ${answer.isCorrect}/${answer.marksObtained}, app would give ${expected.isCorrect}/${expected.marks}`);
      sum += Number(answer.marksObtained);
      regraded += 1;
    }

    const total = Number(test.totalMarks);
    const score = manual ? sum : Math.max(0, sum); // recomputeAttemptScore does not floor; evaluateAttempt does
    check(near(Number(attempt.score), Math.round(score * 100) / 100), `${label}: score ${attempt.score} but answers sum to ${sum}`);
    check(near(Number(attempt.percentage), Math.round((score / total) * 10000) / 100), `${label}: percentage ${attempt.percentage} is wrong`);
    check(attempt.passed === score >= Number(test.passingMarks), `${label}: passed flag is wrong`);
    check(attempt.status === 'EVALUATED', `${label}: status ${attempt.status}`);

    // Timing: inside the window, within the duration, and no longer than the answers allow.
    const started = attempt.startedAt.getTime();
    const submitted = attempt.submittedAt?.getTime() ?? 0;
    check(!!test.startAt && !!test.endAt && started >= test.startAt.getTime() && submitted <= test.endAt.getTime(), `${label}: outside the test window`);
    check(submitted - started === (attempt.timeTakenSeconds ?? -1) * 1000, `${label}: timeTakenSeconds does not match the timestamps`);
    check((attempt.timeTakenSeconds ?? 0) <= test.durationMinutes * 60, `${label}: longer than the test duration`);
    check(attempt.answers.reduce((s, a) => s + (a.timeSpentSeconds ?? 0), 0) <= (attempt.timeTakenSeconds ?? 0), `${label}: answers took longer than the attempt`);
    check(submitted <= Date.now(), `${label}: submitted in the future`);
  }
  check(tests.every((t) => near(Number(t.totalMarks), t.testQuestions.reduce((s, tq) => s + Number(questionById.get(tq.questionId)?.marks ?? 0), 0))),
    'a test total is not the sum of its question marks');

  /* 2. Leaderboard: rebuilt from passed attempts, ranks contiguous and ordered. */
  for (const courseId of new Set(leaderboard.map((l) => l.courseId))) {
    const rows = leaderboard.filter((l) => l.courseId === courseId).sort((a, b) => a.rank - b.rank);
    check(rows.every((r, i) => r.rank === i + 1), `leaderboard ${courseId}: ranks are not 1..n`);
    check(rows.every((r, i) => i === 0 || Number(rows[i - 1].totalScore) >= Number(r.totalScore)), `leaderboard ${courseId}: not ordered by total score`);
    const passed = attempts.filter((a) => a.status === 'EVALUATED' && a.passed && testById.get(a.testId)?.course?.id === courseId);
    check(new Set(passed.map((a) => a.studentId)).size === rows.length, `leaderboard ${courseId}: wrong number of entries`);
    for (const row of rows) {
      const own = passed.filter((a) => a.studentId === row.userId);
      check(near(Number(row.totalScore), own.reduce((s, a) => s + Number(a.score), 0)) && row.testsTaken === own.length,
        `leaderboard ${courseId}: totals wrong for ${row.userId}`);
      check(near(row.avgPercentage, own.reduce((s, a) => s + Number(a.percentage), 0) / own.length), `leaderboard ${courseId}: average wrong for ${row.userId}`);
    }
  }

  /* 3. Question analytics: counts and accuracy rebuilt from the answers. */
  const allAnswers = attempts.flatMap((a) => a.answers);
  for (const row of analytics) {
    const judged = allAnswers.filter((a) => a.questionId === row.questionId && a.isCorrect !== null);
    const correct = judged.filter((a) => a.isCorrect).length;
    check(row.attemptCount === judged.length && row.correctCount === correct && row.incorrectCount === judged.length - correct,
      `analytics ${row.questionId}: counts do not match the answers`);
    check(near(row.accuracy, judged.length ? Math.round((correct / judged.length) * 10000) / 100 : 0), `analytics ${row.questionId}: accuracy wrong`);
  }
  check(analytics.length === questions.length, 'not every question has an analytics row');

  /* 4. Content and shape. */
  const lessonWords = lessons.map((l) => words(l.content ?? ''));
  check(lessons.length === 36 && Math.min(...lessonWords) >= 300, `a lesson is under 300 words (minimum ${Math.min(...lessonWords)})`);
  const perStudent = new Map<string, number>();
  for (const e of enrolments) perStudent.set(e.user.email, (perStudent.get(e.user.email) ?? 0) + 1);
  check([...perStudent.values()].every((n) => n >= 2 && n <= 4) && perStudent.size === 36, 'a student is not enrolled in 2 to 4 courses');
  check(perStudent.get(primaryEmail) === 4, 'the primary student is not enrolled in all four courses');
  const live = attempts.filter((a) => a.status === 'IN_PROGRESS');
  check(live.length === 1 && live[0].student.email !== primaryEmail, 'expected exactly one in-progress attempt, not the primary student');
  check(!attempts.some((a) => a.student.email === primaryEmail && testById.get(a.testId)?.status === 'PUBLISHED'), 'the primary student attempted a live test');
  for (const s of sessions) {
    const weight = (severity: string): number => (severity === 'HIGH' ? 10 : severity === 'MEDIUM' ? 5 : 2);
    check(near(s.suspicionScore, Math.min(100, s.events.reduce((sum, e) => sum + weight(e.severity), 0))), `proctoring session ${s.id}: score does not match its events`);
  }

  /* 5. Accounts: the shared demo password signs in, e-mail verified, no 2FA, reserved domain only. */
  const users = await prisma.user.findMany({ select: { email: true, passwordHash: true, isEmailVerified: true, twoFactorEnabled: true, fullName: true } });
  check(users.length === 43 && users.every((u) => u.email.endsWith(`@${EMAIL_DOMAIN}`) && u.isEmailVerified && !u.twoFactorEnabled && !!u.fullName),
    'an account is unverified, has 2FA, lacks a name or is outside the reserved domain');
  const hashes = new Set(users.map((u) => u.passwordHash));
  check(hashes.size === 1 && (await bcrypt.compare(DEMO_PASSWORD, [...hashes][0] ?? '')), 'the demo password does not match the stored hash');

  /* Report. */
  const own = attempts.filter((a) => a.student.email === primaryEmail);
  console.log(`\nPrimary student (${primaryEmail})`);
  console.table(own
    .map((a) => ({ test: testById.get(a.testId)?.title, score: `${a.score}/${testById.get(a.testId)?.totalMarks}`, percent: Number(a.percentage), passed: a.passed }))
    .sort((a, b) => String(a.test).localeCompare(String(b.test))));

  const byTopic = new Map<string, { course: string; right: number; judged: number }>();
  for (const a of own) {
    for (const answer of a.answers) {
      const q = questionById.get(answer.questionId);
      // Descriptive answers are isCorrect: true whatever the marks, so they say nothing about accuracy.
      if (!q?.topic || answer.isCorrect === null || q.type === 'SUBJECTIVE') continue;
      const entry = byTopic.get(q.topic) ?? { course: testById.get(a.testId)?.course?.code ?? '', right: 0, judged: 0 };
      entry.judged += 1;
      if (answer.isCorrect) entry.right += 1;
      byTopic.set(q.topic, entry);
    }
  }
  console.table([...byTopic.entries()]
    .map(([topic, t]) => ({ course: t.course, topic, correct: `${t.right}/${t.judged}`, accuracy: Math.round((t.right / t.judged) * 100) }))
    .sort((a, b) => a.course.localeCompare(b.course) || a.accuracy - b.accuracy));

  const finished = attempts.filter((a) => a.status === 'EVALUATED');
  console.table(tests.filter((t) => t.status !== 'DRAFT').map((t) => {
    const mine = finished.filter((a) => a.testId === t.id);
    return {
      test: t.title, status: t.status, attempts: mine.length,
      mean: mine.length ? Math.round(mine.reduce((s, a) => s + Number(a.percentage), 0) / mine.length) : null,
      passed: mine.filter((a) => a.passed).length,
    };
  }).sort((a, b) => a.test.localeCompare(b.test)));

  const fingerprint = createHash('sha256')
    .update(attempts
      .map((a) => `${a.student.email}|${testById.get(a.testId)?.title}|${a.status}|${a.score}|${a.percentage}|${a.timeTakenSeconds}|${a.suspicionScore}|${a.answers.length}`)
      .sort().join('\n'))
    .update(leaderboard.map((l) => `${l.rank}|${l.totalScore}|${l.testsTaken}`).sort().join('\n'))
    .digest('hex').slice(0, 16);
  console.log(`Lessons: ${lessons.length}, words min ${Math.min(...lessonWords)} / max ${Math.max(...lessonWords)}`);
  console.log(`Answers re-graded: ${regraded}; attempts: ${attempts.length}; flagged sessions (score >= 50): ${sessions.filter((s) => s.suspicionScore >= 50).length}; ungraded descriptive answers: ${allAnswers.filter((a) => questionById.get(a.questionId)?.type === 'SUBJECTIVE' && a.isCorrect === null && a.marksObtained !== null).length}`);
  console.log(`Fingerprint: ${fingerprint}`);

  if (failures.length) {
    console.error(`\nFAILED: ${failures.length} check(s)\n  - ${failures.slice(0, 25).join('\n  - ')}`);
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed.');
  }
}

main()
  .catch((e) => {
    console.error('Verify failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
