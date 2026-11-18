import { describe, expect, it } from 'vitest';
import { peopleScope } from '../src/ai/records.js';

describe('AI people scope', () => {
  it('lets admins see every account and org admins every account in their organisation', () => {
    expect(peopleScope('ADMIN')).toEqual({ kind: 'roles', roles: null, ownOrgOnly: false });
    expect(peopleScope('ORG_ADMIN')).toEqual({ kind: 'roles', roles: null, ownOrgOnly: true });
  });

  it('limits teachers to student accounts in their organisation', () => {
    expect(peopleScope('TEACHER')).toEqual({ kind: 'roles', roles: ['STUDENT'], ownOrgOnly: true });
  });

  it('limits students, proctors and unknown roles to themselves', () => {
    for (const role of ['STUDENT', 'PROCTOR', 'SOMETHING_ELSE']) expect(peopleScope(role)).toEqual({ kind: 'self' });
  });
});
