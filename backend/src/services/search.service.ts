import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { isAdmin, isStaff } from '../middleware/authorize.js';
import type { Viewer } from './access.service.js';

const EMPTY = { courses: [], tests: [], questions: [], assignments: [], users: [], lessons: [], count: 0 };

/**
 * Search across the platform, limited to what the viewer could open anyway.
 * Without this scoping a student could read exam questions, unpublished tests
 * and every account's email just by typing into the search box.
 *
 *   administrators  everything
 *   teachers        their own tests, questions and assignments; students by name
 *   students        tests assigned to them, assignments of their courses; no questions, no people
 *   proctors        courses and lessons only
 */
export async function globalSearch(viewer: Viewer, query: string, limit = 10) {
  const q = query.trim().slice(0, 200);
  if (!q) return EMPTY;
  const take = Math.min(25, Math.max(1, limit));
  const admin = isAdmin(viewer.role);
  const staff = isStaff(viewer.role);
  const student = viewer.role === 'STUDENT';
  const none = Promise.resolve([]);

  const testScope: Prisma.TestWhereInput | null = admin
    ? {}
    : staff
      ? { createdById: viewer.id }
      : student
        ? {
            status: 'PUBLISHED',
            assignments: { some: { OR: [{ studentId: viewer.id }, { class: { students: { some: { studentId: viewer.id } } } }] } },
          }
        : null;
  const assignmentScope: Prisma.AssignmentWhereInput | null = admin
    ? {}
    : staff
      ? { createdById: viewer.id }
      : student
        ? { course: { enrollments: { some: { userId: viewer.id } } } }
        : null;

  const [courses, tests, questions, assignments, users, lessons] = await Promise.all([
    prisma.course.findMany({
      where: { OR: [{ name: { contains: q } }, { code: { contains: q } }, { description: { contains: q } }] },
      select: { id: true, name: true, code: true, description: true, category: true },
      take,
    }),
    testScope
      ? prisma.test.findMany({
          where: { AND: [testScope, { OR: [{ title: { contains: q } }, { description: { contains: q } }] }] },
          select: { id: true, title: true, description: true, status: true, examMode: true },
          take,
        })
      : none,
    // Question text is exam content: only its author or an administrator may search it.
    staff
      ? prisma.question.findMany({
          where: {
            ...(admin ? {} : { createdById: viewer.id }),
            OR: [{ text: { contains: q } }, { topic: { contains: q } }, { subtopic: { contains: q } }],
          },
          select: { id: true, text: true, type: true, difficulty: true, topic: true },
          take,
        })
      : none,
    assignmentScope
      ? prisma.assignment.findMany({
          where: { AND: [assignmentScope, { OR: [{ title: { contains: q } }, { description: { contains: q } }] }] },
          select: { id: true, title: true, description: true, dueAt: true },
          take,
        })
      : none,
    staff
      ? prisma.user.findMany({
          where: {
            isBlocked: false,
            ...(admin ? {} : { role: 'STUDENT' }),
            OR: [{ fullName: { contains: q } }, { username: { contains: q } }, { email: { contains: q } }],
          },
          select: { id: true, fullName: true, username: true, email: true, role: true },
          take,
        })
      : none,
    prisma.lesson.findMany({
      where: { OR: [{ title: { contains: q } }, { content: { contains: q } }] },
      select: { id: true, title: true, type: true, module: { select: { course: { select: { code: true, name: true } } } } },
      take,
    }),
  ]);

  return {
    courses,
    tests,
    questions,
    assignments,
    users,
    lessons,
    count: courses.length + tests.length + questions.length + assignments.length + users.length + lessons.length,
  };
}
