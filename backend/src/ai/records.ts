import { prisma } from '../config/database.js';

/**
 * Live, role-scoped snapshots of platform data for the assistant. Each one is
 * read fresh from the database on every question, so answers like "how many
 * assignments are pending" or "how many students graduate this year" reflect
 * the current state, not a cached report.
 *
 * Scope is decided here, in code, by the caller's role:
 * - student: that student's own tests, assignments and coding problems;
 * - teacher: aggregates over content they created, plus student and placement totals;
 * - admin: platform-wide aggregates including accounts by role.
 * The people directory (peopleDirectory) adds per-person rows: admins see every
 * account, teachers see students only, students and proctors see only themselves.
 * Nothing here ever returns password hashes or 2FA secrets.
 */

const DAY = 24 * 60 * 60 * 1000;
const round = (v: number, dp = 1) => Math.round(v * 10 ** dp) / 10 ** dp;
const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : null);
const countBy = <T>(xs: T[], key: (x: T) => string | number | null | undefined) => {
  const out: Record<string, number> = {};
  for (const x of xs) {
    const k = String(key(x) ?? 'unknown');
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
const grouped = (rows: { _count: { _all: number } }[], key: (r: any) => unknown) =>
  Object.fromEntries(rows.map((r) => [String(key(r) ?? 'unknown'), r._count._all]));

/* -------------------------------------------------------------- student */

export async function studentWorkload(studentId: string) {
  const now = new Date();
  const enrolled = await prisma.enrollment.findMany({ where: { userId: studentId }, select: { courseId: true } });
  const courseIds = enrolled.map((e) => e.courseId);
  const inMyCourses = { OR: [{ courseId: null }, { courseId: { in: courseIds } }] };

  const [testAssignments, assignments, problems] = await Promise.all([
    prisma.testAssignment.findMany({
      where: {
        test: { status: 'PUBLISHED' },
        OR: [{ studentId }, { class: { students: { some: { studentId } } } }],
      },
      select: {
        dueAt: true,
        test: {
          select: {
            id: true,
            title: true,
            examMode: true,
            durationMinutes: true,
            totalMarks: true,
            maxAttempts: true,
            startAt: true,
            endAt: true,
            course: { select: { name: true } },
            testQuestions: { select: { question: { select: { type: true } } } },
            attempts: { where: { studentId }, select: { status: true, percentage: true, passed: true } },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: inMyCourses,
      select: {
        title: true,
        dueAt: true,
        maxMarks: true,
        course: { select: { name: true } },
        submissions: { where: { studentId }, select: { submittedAt: true, marks: true } },
      },
      orderBy: { dueAt: 'asc' },
    }),
    prisma.codingProblem.findMany({
      where: inMyCourses,
      select: {
        title: true,
        difficulty: true,
        course: { select: { name: true } },
        submissions: { where: { userId: studentId }, select: { status: true } },
      },
    }),
  ]);

  // One test can be assigned both directly and through a class.
  const tests = new Map<string, (typeof testAssignments)[number]['test'] & { dueAt: Date | null }>();
  for (const a of testAssignments) {
    const prev = tests.get(a.test.id);
    const due = a.dueAt ?? a.test.endAt;
    if (!prev || (due && (!prev.dueAt || due < prev.dueAt))) tests.set(a.test.id, { ...a.test, dueAt: due });
  }

  const testRows = [...tests.values()].map((t) => {
    const submitted = t.attempts.filter((a) => a.status !== 'IN_PROGRESS');
    const inProgress = t.attempts.some((a) => a.status === 'IN_PROGRESS');
    const closed = (t.endAt && t.endAt < now) || (t.dueAt && t.dueAt < now);
    const notOpenYet = t.startAt && t.startAt > now;
    const state = submitted.length
      ? 'completed'
      : inProgress
        ? 'in_progress'
        : closed
          ? 'missed'
          : notOpenYet
            ? 'upcoming'
            : 'pending';
    return {
      title: t.title,
      course: t.course?.name ?? null,
      mode: t.examMode,
      state,
      opensAt: iso(t.startAt),
      dueAt: iso(t.dueAt),
      durationMinutes: t.durationMinutes,
      totalMarks: Number(t.totalMarks),
      attemptsUsed: t.attempts.length,
      maxAttempts: t.maxAttempts,
      bestPercentage: submitted.length ? Math.max(...submitted.map((a) => Number(a.percentage ?? 0))) : null,
      questionTypes: countBy(t.testQuestions, (q) => q.question.type),
    };
  });

  const assignmentRows = assignments.map((a) => {
    const sub = a.submissions[0];
    return {
      title: a.title,
      course: a.course?.name ?? null,
      dueAt: iso(a.dueAt),
      maxMarks: Number(a.maxMarks),
      state: sub ? (sub.marks != null ? 'graded' : 'submitted') : a.dueAt && a.dueAt < now ? 'overdue' : 'pending',
      marks: sub?.marks != null ? Number(sub.marks) : null,
    };
  });

  const codingRows = problems.map((p) => ({
    title: p.title,
    course: p.course?.name ?? null,
    difficulty: p.difficulty,
    state: p.submissions.some((s) => s.status === 'ACCEPTED')
      ? 'solved'
      : p.submissions.length
        ? 'attempted'
        : 'not_started',
    submissions: p.submissions.length,
  }));
  const openCoding = codingRows.filter((c) => c.state !== 'solved');
  const pendingTests = testRows.filter((t) => t.state === 'pending' || t.state === 'in_progress' || t.state === 'upcoming');

  return {
    generatedAt: iso(now),
    summary: {
      testsAssigned: testRows.length,
      testsByState: countBy(testRows, (t) => t.state),
      assignmentsTotal: assignmentRows.length,
      assignmentsByState: countBy(assignmentRows, (a) => a.state),
      codingProblemsTotal: codingRows.length,
      codingByState: countBy(codingRows, (c) => c.state),
      openCodingByDifficulty: countBy(openCoding, (c) => c.difficulty),
      questionTypesInPendingTests: pendingTests.reduce<Record<string, number>>((acc, t) => {
        for (const [k, v] of Object.entries(t.questionTypes)) acc[k] = (acc[k] ?? 0) + v;
        return acc;
      }, {}),
    },
    tests: testRows.sort((a, b) => (a.dueAt ?? '9').localeCompare(b.dueAt ?? '9')),
    assignments: assignmentRows,
    codingProblems: codingRows,
  };
}

/* ---------------------------------------------------------------- staff */

export async function staffSnapshot(viewer: { id: string; admin: boolean }) {
  const now = new Date();
  const year = now.getFullYear();
  const mine = viewer.admin ? {} : { createdById: viewer.id };
  const myTests = viewer.admin ? {} : { test: { createdById: viewer.id } };

  const [
    usersByRole,
    blocked,
    newUsers7d,
    activeToday,
    studentTotal,
    gradYears,
    branches,
    profiles,
    batches,
    courses,
    enrollments,
    testsByStatus,
    attemptsByStatus,
    passStats,
    passedCount,
    attemptsToday,
    questionsByType,
    questionsByDifficulty,
    codingByDifficulty,
    codeSubs,
    acceptedSubs,
    assignmentTotal,
    assignmentSubs,
    ungraded,
    drivesByStatus,
    applicationsByStatus,
    placedStudents,
    flaggedSessions,
  ] = await Promise.all([
    viewer.admin ? prisma.user.groupBy({ by: ['role'], _count: { _all: true } }) : Promise.resolve(null),
    viewer.admin ? prisma.user.count({ where: { OR: [{ isBlocked: true }, { isActive: false }] } }) : Promise.resolve(null),
    viewer.admin ? prisma.user.count({ where: { createdAt: { gte: new Date(+now - 7 * DAY) } } }) : Promise.resolve(null),
    viewer.admin ? prisma.user.count({ where: { lastLoginAt: { gte: new Date(+now - DAY) } } }) : Promise.resolve(null),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.placementProfile.groupBy({ by: ['graduationYear'], _count: { _all: true } }),
    prisma.placementProfile.groupBy({ by: ['branch'], _count: { _all: true } }),
    prisma.placementProfile.aggregate({ _count: { _all: true }, _avg: { cgpa: true } }),
    prisma.batch.findMany({ select: { name: true, startYear: true, endYear: true, _count: { select: { students: true } } } }),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.test.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
    prisma.attempt.groupBy({ by: ['status'], where: myTests, _count: { _all: true } }),
    prisma.attempt.aggregate({ where: { ...myTests, status: { not: 'IN_PROGRESS' } }, _avg: { percentage: true }, _count: { _all: true } }),
    prisma.attempt.count({ where: { ...myTests, passed: true } }),
    prisma.attempt.count({ where: { ...myTests, startedAt: { gte: new Date(+now - DAY) } } }),
    prisma.question.groupBy({ by: ['type'], where: mine, _count: { _all: true } }),
    prisma.question.groupBy({ by: ['difficulty'], where: mine, _count: { _all: true } }),
    prisma.codingProblem.groupBy({ by: ['difficulty'], where: mine, _count: { _all: true } }),
    prisma.codeSubmission.count({ where: viewer.admin ? {} : { problem: { createdById: viewer.id } } }),
    prisma.codeSubmission.count({ where: { status: 'ACCEPTED', ...(viewer.admin ? {} : { problem: { createdById: viewer.id } }) } }),
    prisma.assignment.count({ where: mine }),
    prisma.assignmentSubmission.count({ where: viewer.admin ? {} : { assignment: { createdById: viewer.id } } }),
    prisma.assignmentSubmission.count({ where: { marks: null, ...(viewer.admin ? {} : { assignment: { createdById: viewer.id } }) } }),
    prisma.placementDrive.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.placementApplication.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.placementApplication.findMany({ where: { status: 'SELECTED' }, distinct: ['studentId'], select: { studentId: true } }),
    prisma.proctoringSession.count({ where: { ...myTests, suspicionScore: { gte: 50 } } }),
  ]);

  const years = grouped(gradYears, (r) => r.graduationYear);
  const known = gradYears.filter((r) => r.graduationYear != null);
  const sumWhere = (pred: (y: number) => boolean) =>
    known.filter((r) => pred(r.graduationYear!)).reduce((n, r) => n + r._count._all, 0);
  const submitted = passStats._count._all;

  return {
    generatedAt: iso(now),
    scope: viewer.admin ? 'whole platform' : 'content you created (tests, questions, assignments, coding problems); student and placement totals are platform-wide',
    ...(viewer.admin && {
      accounts: {
        byRole: grouped(usersByRole!, (r) => r.role),
        total: usersByRole!.reduce((n, r) => n + r._count._all, 0),
        blockedOrInactive: blocked,
        newInLast7Days: newUsers7d,
        loggedInLast24h: activeToday,
      },
    }),
    students: {
      total: studentTotal,
      withPlacementProfile: profiles._count._all,
      averageCgpa: profiles._avg.cgpa != null ? round(profiles._avg.cgpa, 2) : null,
      byGraduationYear: years,
      graduated: sumWhere((y) => y < year),
      graduatingThisYear: sumWhere((y) => y === year),
      graduatingLater: sumWhere((y) => y > year),
      graduationYearUnknown: studentTotal - known.reduce((n, r) => n + r._count._all, 0),
      note: 'graduation data comes from student placement profiles; students without a profile have no recorded graduation year',
      byBranch: grouped(branches, (r) => r.branch),
      batches: batches.map((b) => ({ name: b.name, startYear: b.startYear, endYear: b.endYear, students: b._count.students })),
    },
    courses: { total: courses, enrollments },
    tests: {
      byStatus: grouped(testsByStatus, (r) => r.status),
      attemptsByStatus: grouped(attemptsByStatus, (r) => r.status),
      submittedAttempts: submitted,
      passed: passedCount,
      passRatePercent: submitted ? round((passedCount / submitted) * 100) : null,
      averagePercentage: passStats._avg.percentage != null ? round(Number(passStats._avg.percentage)) : null,
      attemptsStartedLast24h: attemptsToday,
      flaggedProctoringSessions: flaggedSessions,
    },
    questionBank: {
      byType: grouped(questionsByType, (r) => r.type),
      byDifficulty: grouped(questionsByDifficulty, (r) => r.difficulty),
    },
    coding: {
      problemsByDifficulty: grouped(codingByDifficulty, (r) => r.difficulty),
      submissions: codeSubs,
      accepted: acceptedSubs,
    },
    assignments: { total: assignmentTotal, submissions: assignmentSubs, awaitingGrading: ungraded },
    placements: {
      drivesByStatus: grouped(drivesByStatus, (r) => r.status),
      applicationsByStatus: grouped(applicationsByStatus, (r) => r.status),
      studentsPlaced: placedStudents.length,
    },
  };
}

/* --------------------------------------------------------------- people */

type PeopleScope = { kind: 'roles'; roles: string[] | null; ownOrgOnly: boolean } | { kind: 'self' };

/**
 * Whose records the assistant may read, decided by the asker's role:
 * admins see every account, org admins every account in their organisation,
 * teachers students in their organisation, everyone else only themselves.
 */
export function peopleScope(role: string): PeopleScope {
  if (role === 'ADMIN') return { kind: 'roles', roles: null, ownOrgOnly: false };
  if (role === 'ORG_ADMIN') return { kind: 'roles', roles: null, ownOrgOnly: true };
  if (role === 'TEACHER') return { kind: 'roles', roles: ['STUDENT'], ownOrgOnly: true };
  return { kind: 'self' };
}

/** One compact row per person the viewer may see. Never includes password hashes or 2FA secrets. */
export async function peopleDirectory(viewer: { id: string; role: string }) {
  const scope = peopleScope(viewer.role);
  let where: Record<string, unknown> = { id: viewer.id };
  if (scope.kind === 'roles') {
    where = scope.roles ? { role: { in: scope.roles as ('ADMIN' | 'TEACHER' | 'STUDENT' | 'PROCTOR' | 'ORG_ADMIN')[] } } : {};
    if (scope.ownOrgOnly) {
      const me = await prisma.user.findUnique({ where: { id: viewer.id }, select: { organizationId: true } });
      // No organisation means nobody to share one with: fall back to the viewer's own row.
      where = me?.organizationId ? { ...where, organizationId: me.organizationId } : { id: viewer.id };
    }
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    select: {
      id: true,
      fullName: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      isBlocked: true,
      lastLoginAt: true,
      organization: { select: { name: true } },
      batchStudents: { select: { batch: { select: { name: true } } } },
      enrollments: { select: { course: { select: { code: true } } } },
      placementProfile: { select: { branch: true, cgpa: true, graduationYear: true } },
      _count: {
        select: {
          createdTests: true,
          createdQuestions: true,
          createdAssignments: true,
          proctoredSessions: true,
          assignmentSubmissions: true,
        },
      },
    },
  });
  const ids = users.map((u) => u.id);
  const [attempts, passed, placed] = await Promise.all([
    prisma.attempt.groupBy({
      by: ['studentId'],
      where: { studentId: { in: ids }, status: { not: 'IN_PROGRESS' } },
      _count: { _all: true },
      _avg: { percentage: true },
    }),
    prisma.attempt.groupBy({ by: ['studentId'], where: { studentId: { in: ids }, passed: true }, _count: { _all: true } }),
    prisma.placementApplication.findMany({
      where: { studentId: { in: ids }, status: 'SELECTED' },
      distinct: ['studentId'],
      select: { studentId: true },
    }),
  ]);
  const attemptsBy = new Map(attempts.map((a) => [a.studentId, a]));
  const passedBy = new Map(passed.map((p) => [p.studentId, p._count._all]));
  const placedIds = new Set(placed.map((p) => p.studentId));

  const people = users.map((u) => {
    const base = {
      name: u.fullName ?? u.username,
      username: u.username,
      email: u.email,
      role: u.role,
      organization: u.organization?.name ?? null,
      status: u.isBlocked ? 'blocked' : u.isActive ? 'active' : 'inactive',
      lastLogin: iso(u.lastLoginAt),
    };
    if (u.role === 'STUDENT') {
      const a = attemptsBy.get(u.id);
      return {
        ...base,
        batches: u.batchStudents.map((b) => b.batch.name),
        courses: u.enrollments.map((e) => e.course.code),
        testsSubmitted: a?._count._all ?? 0,
        testsPassed: passedBy.get(u.id) ?? 0,
        averagePercentage: a?._avg.percentage != null ? round(Number(a._avg.percentage)) : null,
        assignmentsSubmitted: u._count.assignmentSubmissions,
        branch: u.placementProfile?.branch ?? null,
        cgpa: u.placementProfile ? round(u.placementProfile.cgpa, 2) : null,
        graduationYear: u.placementProfile?.graduationYear ?? null,
        placed: placedIds.has(u.id),
      };
    }
    return {
      ...base,
      testsCreated: u._count.createdTests,
      questionsCreated: u._count.createdQuestions,
      assignmentsCreated: u._count.createdAssignments,
      ...(u.role === 'PROCTOR' && { sessionsProctored: u._count.proctoredSessions }),
    };
  });

  return {
    visibleTo: scope.kind === 'self' ? 'only your own account' : scope.roles ? `${scope.roles.join(', ').toLowerCase()} accounts only` : 'all accounts',
    total: people.length,
    people,
  };
}

/* -------------------------------------------------------------- attempt */

const selectedOptionIds = (answer: { optionId: string | null; answerJson: unknown } | undefined): string[] => {
  if (!answer) return [];
  const ids = answer.optionId ? [answer.optionId] : [];
  const json = answer.answerJson;
  if (json && typeof json === 'object' && 'optionIds' in json && Array.isArray(json.optionIds)) {
    ids.push(...(json.optionIds as string[]));
  }
  return ids;
};

/**
 * What a finished attempt says about the student: marks per topic, weakest
 * first, and the questions they lost marks on with what they chose against the
 * key. The caller must already have checked that the viewer may read the attempt.
 */
export async function attemptBreakdown(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      status: true,
      score: true,
      percentage: true,
      passed: true,
      timeTakenSeconds: true,
      answers: { select: { questionId: true, optionId: true, answerJson: true, isCorrect: true, marksObtained: true } },
      test: {
        select: {
          title: true,
          totalMarks: true,
          passingMarks: true,
          durationMinutes: true,
          courseId: true,
          course: { select: { name: true, code: true } },
          testQuestions: {
            orderBy: { orderIndex: 'asc' },
            select: {
              marksOverride: true,
              question: {
                select: {
                  id: true,
                  text: true,
                  topic: true,
                  difficulty: true,
                  marks: true,
                  explanation: true,
                  options: { orderBy: { orderIndex: 'asc' }, select: { id: true, text: true, isCorrect: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const answers = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const topics = new Map<string, { questions: number; correct: number; marks: number; outOf: number }>();
  const missed: { topic: string; difficulty: string; question: string; chose: string; correct: string; explanation: string | null }[] = [];

  for (const { question, marksOverride } of attempt.test.testQuestions) {
    const topic = question.topic ?? 'General';
    const answer = answers.get(question.id);
    const outOf = Number(marksOverride ?? question.marks);
    const row = topics.get(topic) ?? { questions: 0, correct: 0, marks: 0, outOf: 0 };
    row.questions += 1;
    row.outOf += outOf;
    row.marks += Number(answer?.marksObtained ?? 0);
    if (answer?.isCorrect) row.correct += 1;
    topics.set(topic, row);

    if (!answer?.isCorrect && question.options.length) {
      const chosen = selectedOptionIds(answer);
      missed.push({
        topic,
        difficulty: question.difficulty,
        question: question.text,
        chose: question.options.filter((o) => chosen.includes(o.id)).map((o) => o.text).join(' | ') || 'not answered',
        correct: question.options.filter((o) => o.isCorrect).map((o) => o.text).join(' | '),
        explanation: question.explanation,
      });
    }
  }

  const byTopic = [...topics.entries()]
    .map(([topic, t]) => ({ topic, ...t, marks: round(t.marks, 2), percent: t.outOf ? round((t.marks / t.outOf) * 100) : 0 }))
    .sort((a, b) => a.percent - b.percent);

  return {
    courseId: attempt.test.courseId,
    status: attempt.status,
    result: {
      test: attempt.test.title,
      course: attempt.test.course?.name ?? null,
      score: Number(attempt.score ?? 0),
      totalMarks: Number(attempt.test.totalMarks),
      passingMarks: Number(attempt.test.passingMarks),
      percentage: Number(attempt.percentage ?? 0),
      passed: attempt.passed,
      minutesTaken: attempt.timeTakenSeconds != null ? Math.round(attempt.timeTakenSeconds / 60) : null,
      minutesAllowed: attempt.test.durationMinutes,
      byTopic,
      // Enough wrong answers to see the pattern without flooding the prompt.
      missed: missed.slice(0, 10),
    },
  };
}
