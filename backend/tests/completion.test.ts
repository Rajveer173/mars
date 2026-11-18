import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sandboxArguments } from '../src/services/codeSandbox.js';

const db = vi.hoisted(() => ({
  assignmentSubmission: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  assignment: { findUnique: vi.fn() },
}));
vi.mock('../src/config/database.js', () => ({ prisma: db }));
import { gradeSubmission, submitAssignment } from '../src/services/assignment.service.js';
beforeEach(() => vi.clearAllMocks());

describe('assignment grading permissions', () => {
  const submission = { id: 'submission', assignment: { id: 'assignment', createdById: 'owner', maxMarks: 100 } };
  it('refuses another teacher even when they know the submission ID', async () => {
    db.assignmentSubmission.findUnique.mockResolvedValue(submission);
    db.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
    await expect(gradeSubmission('submission', 'someone-else', { marks: 80 })).rejects.toMatchObject({ statusCode: 403 });
    expect(db.assignmentSubmission.update).not.toHaveBeenCalled();
  });
  it('lets the creator grade within the assignment maximum', async () => {
    db.assignmentSubmission.findUnique.mockResolvedValue(submission);
    db.user.findUnique.mockResolvedValue({ role: 'TEACHER' });
    await gradeSubmission('submission', 'owner', { marks: 80, feedback: 'Clear reasoning' });
    expect(db.assignmentSubmission.update).toHaveBeenCalledWith(expect.objectContaining({ data: { marks: 80, feedback: 'Clear reasoning' } }));
  });
  it('does not let resubmission replace already graded work', async () => {
    db.assignment.findUnique.mockResolvedValue({ id: 'assignment', dueAt: null });
    db.user.findUnique.mockResolvedValue({ role: 'STUDENT' });
    db.assignmentSubmission.findUnique.mockResolvedValue({ id: 'submission', marks: 80 });
    await expect(submitAssignment('assignment', 'student', { answerText: 'changed' })).rejects.toMatchObject({ statusCode: 409 });
    expect(db.assignmentSubmission.update).not.toHaveBeenCalled();
  });
});

describe('code runner isolation', () => {
  it('disables networking, host writes, privilege escalation and unbounded resources', () => {
    const args = sandboxArguments('python', '/tmp/submission', 'run-test', 128);
    for (const flag of ['--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=32', '--memory=128m', '--memory-swap=128m', '--user=65534:65534', '--pull=never']) expect(args).toContain(flag);
    expect(args).toContain('type=bind,source=/tmp/submission,target=/source,readonly');
    expect(args).not.toContain('--privileged');
  });
  it('rejects a language that could be interpreted as a command', () => {
    expect(() => sandboxArguments('sh -c malicious', '/tmp/submission', 'run-test', 128)).toThrow('Unsupported language');
  });
});
