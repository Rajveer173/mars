import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Page } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { formatDateTime, titleCase } from '@/lib/format';
import { Button, Empty, Input, PageHeader, SectionTitle, Tag } from '@/ui/core';
import { ActionForm, QueryState, options, type FormField } from '@/ui/forms';
import { Dialog, toast } from '@/ui/overlay';

interface Application { id: string; status: string; currentRound: string | null; assessmentScore: number | null; notes: string | null; proctorStatus: string; proctorNotes: string | null; student: { fullName: string | null; email: string }; drive?: { companyName: string; role: string } }
interface Drive { id: string; companyName: string; role: string; description: string | null; ctcLpa: number | null; location: string | null; deadline: string; driveType: string; status: string; applicantCount: number; canApply?: boolean; hasApplied?: boolean; applicationStatus?: string | null; eligibilityReasons?: string[]; closedReason?: string; applications?: Application[] }
const driveFields: FormField[] = [
  { name: 'companyName', label: 'Company', required: true }, { name: 'role', label: 'Role', required: true },
  { name: 'driveType', label: 'Drive type', type: 'select', options: options(['ON_CAMPUS', 'OFF_CAMPUS']), required: true },
  { name: 'status', label: 'Status', type: 'select', options: options(['UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED']), required: true },
  { name: 'ctcLpa', label: 'CTC (LPA)', type: 'number', min: 0, step: '0.1' }, { name: 'location', label: 'Location' },
  { name: 'deadline', label: 'Application deadline', type: 'datetime-local', required: true }, { name: 'eligibilityCgpa', label: 'Minimum CGPA', type: 'number', min: 0, max: 10, step: '0.01' },
  { name: 'maxBacklogs', label: 'Maximum backlogs', type: 'number', min: 0, max: 50 }, { name: 'batchYear', label: 'Graduation year', type: 'number', min: 2000, max: 2040 },
  { name: 'description', label: 'About the opportunity', type: 'textarea' },
];
const profileFields: FormField[] = [
  { name: 'fullName', label: 'Full name', required: true }, { name: 'rollNumber', label: 'Roll number' },
  { name: 'branch', label: 'Branch', required: true, hint: 'For example: CSE, ECE, IT or ME.' }, { name: 'cgpa', label: 'CGPA', type: 'number', required: true, min: 0, max: 10, step: '0.01' },
  { name: 'graduationYear', label: 'Graduation year', type: 'number', min: 2000, max: 2040 }, { name: 'activeBacklogs', label: 'Active backlogs', type: 'number', min: 0, max: 50 },
  { name: 'tenthPercentage', label: '10th percentage', type: 'number', min: 0, max: 100, step: '0.01' }, { name: 'twelfthPercentage', label: '12th percentage', type: 'number', min: 0, max: 100, step: '0.01' },
  { name: 'phone', label: 'Phone' }, { name: 'resumeUrl', label: 'Resume link', type: 'url' }, { name: 'githubUrl', label: 'GitHub link', type: 'url' }, { name: 'linkedinUrl', label: 'LinkedIn link', type: 'url' },
];
const stringValues = (data: Record<string, unknown> | null | undefined) => Object.fromEntries(Object.entries(data ?? {}).filter(([, value]) => value != null && typeof value !== 'object').map(([key, value]) => [key, String(value)]));

export function Placements() {
  const user = useAuth(state => state.user)!;
  if (user.role === 'PROCTOR') return <PlacementCandidates />;
  return <PlacementBoard />;
}

function PlacementBoard() {
  const user = useAuth(state => state.user)!;
  const staff = isStaffRole(user.role);
  const client = useQueryClient();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const query = useQuery({ queryKey: ['placements', 'drives'], queryFn: () => api.get<{ drives: Drive[] }>('/placements/drives') });
  const profile = useQuery({ queryKey: ['placements', 'profile'], queryFn: () => api.get<{ profile: Record<string, unknown> | null }>('/placements/profile'), enabled: !staff });
  const detail = useQuery({ queryKey: ['placements', 'drive', selected], queryFn: () => api.get<{ drive: Drive }>(`/placements/drives/${selected}`), enabled: !!selected });
  const refresh = () => client.invalidateQueries({ queryKey: ['placements'] });
  const drive = detail.data?.drive;
  async function apply(action: 'apply' | 'withdraw') { setBusy(true); try { await api.post(`/placements/drives/${selected}/${action}`); await refresh(); toast.done(action === 'apply' ? 'Application submitted' : 'Application withdrawn'); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); } }
  const visible = query.data?.drives.filter(item => `${item.companyName} ${item.role} ${item.location}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <Page><PageHeader title="Your next chapter" description={staff ? 'Connect your students with their next opportunity.' : 'Opportunities matched against your academic profile.'} actions={staff ? <Button onClick={() => setCreating(true)}>Create placement drive</Button> : <Button variant="secondary" onClick={() => setEditingProfile(true)}>Your placement profile</Button>} />
    <Input className="mb-8 max-w-md" aria-label="Find placements" placeholder="Search company, role or location" value={search} onChange={event => setSearch(event.target.value)} />
    <QueryState query={query}>{!visible.length && <Empty title="No matching opportunities">Try a different search, or check back for new drives.</Empty>}<div className="grid gap-4 md:grid-cols-2">{visible.map(item => <button key={item.id} onClick={() => setSelected(item.id)} className="rounded-lg border border-rule bg-paper p-6 text-left transition-colors hover:border-ink"><div className="flex justify-between gap-3"><p className="text-sm font-medium text-ink-3">{item.companyName}</p><Tag tone={item.status === 'ACTIVE' ? 'tick' : 'neutral'}>{titleCase(item.status)}</Tag></div><h2 className="display mt-3 text-2xl">{item.role}</h2><p className="mt-2 text-ink-2">{item.location ?? 'Location to be announced'} · {item.ctcLpa ? `${item.ctcLpa} LPA` : 'CTC to be announced'}</p><div className="mt-6 flex flex-wrap justify-between gap-2 text-sm text-ink-3"><span>Apply by {formatDateTime(item.deadline)}</span>{staff ? <span>{item.applicantCount} applicants</span> : item.hasApplied ? <Tag tone="pen">{titleCase(item.applicationStatus)}</Tag> : item.canApply ? <Tag tone="tick">Eligible to apply</Tag> : <Tag>View eligibility</Tag>}</div></button>)}</div></QueryState>
    <Dialog open={creating} onOpenChange={setCreating} title="Create placement drive" size="lg">{creating && <ActionForm fields={driveFields} initial={{ driveType: 'ON_CAMPUS', status: 'UPCOMING' }} submitLabel="Create drive" onSubmit={async values => { await api.post('/placements/drives', { ...values, deadline: new Date(values.deadline).toISOString() }); setCreating(false); await refresh(); toast.done('Placement drive created'); }} />}</Dialog>
    <Dialog open={editingProfile} onOpenChange={setEditingProfile} title="Your placement profile" size="lg"><QueryState query={profile}>{editingProfile && profile.data && <ActionForm fields={profileFields} initial={{ fullName: user.fullName ?? '', activeBacklogs: '0', ...stringValues(profile.data.profile) }} onSubmit={async values => { const body = Object.fromEntries(profileFields.map(field => [field.name, values[field.name] ?? ''])); await api.post('/placements/profile', body); setEditingProfile(false); await refresh(); toast.done('Placement profile saved'); }} />}</QueryState></Dialog>
    <Dialog open={!!selected} onOpenChange={() => setSelected(null)} title={drive ? `${drive.companyName} · ${drive.role}` : 'Placement drive'} size="lg"><QueryState query={detail}>{drive && <>
      <p className="mb-5 whitespace-pre-wrap leading-relaxed text-ink-2">{drive.description}</p><p className="mb-6 text-sm text-ink-3">Applications close {formatDateTime(drive.deadline)}</p>
      {!staff ? <>{drive.applicationStatus && <Tag tone="pen">{titleCase(drive.applicationStatus)}</Tag>}{drive.eligibilityReasons?.map(reason => <p key={reason} className="my-2 text-sm text-ink-2">{reason}</p>)}{drive.closedReason && <p className="my-3 text-ink-3">{drive.closedReason}</p>}<div className="mt-5">{drive.canApply && <Button loading={busy} onClick={() => void apply('apply')}>Apply for this role</Button>}{drive.hasApplied && !['SELECTED', 'REJECTED'].includes(drive.applicationStatus ?? '') && <Button variant="secondary" loading={busy} onClick={() => void apply('withdraw')}>Withdraw application</Button>}</div></> : <>
        <ActionForm fields={[driveFields[3]]} initial={{ status: drive.status }} submitLabel="Update drive status" onSubmit={async values => { await api.put(`/placements/drives/${drive.id}`, values); await refresh(); toast.done('Drive updated'); }} />
        <SectionTitle className="mt-8">Applicants</SectionTitle>{!drive.applications?.length && <Empty title="No applications yet" />}{drive.applications?.map(application => <article key={application.id} className="border-t border-rule py-5"><h3 className="mb-3 font-semibold">{application.student.fullName ?? application.student.email}</h3><ActionForm fields={[{ name: 'status', label: 'Application status', type: 'select', required: true, options: options(['APPLIED', 'SHORTLISTED', 'INTERVIEWED', 'SELECTED', 'REJECTED']) }, { name: 'currentRound', label: 'Current round' }, { name: 'notes', label: 'Feedback for applicant', type: 'textarea' }]} initial={{ status: application.status, currentRound: application.currentRound ?? '', notes: application.notes ?? '' }} submitLabel="Update application" onSubmit={async values => { await api.patch(`/placements/applications/${application.id}/status`, values); await refresh(); toast.done('Application updated'); }} /></article>)}
      </>}
    </>}</QueryState></Dialog>
  </Page>;
}

function PlacementCandidates() {
  const query = useQuery({ queryKey: ['placements', 'candidates'], queryFn: () => api.get<{ candidates: Application[] }>('/placements/proctor/candidates') });
  const [selected, setSelected] = useState<Application | null>(null);
  return <Page><PageHeader title="Placement assessments" description="Review candidate verification and assessment notes." /><QueryState query={query}>{!query.data?.candidates.length && <Empty title="No candidates yet" />}{query.data?.candidates.map(candidate => <button key={candidate.id} onClick={() => setSelected(candidate)} className="flex w-full items-center justify-between gap-4 border-t border-rule py-5 text-left"><div><h2 className="font-medium">{candidate.student.fullName ?? candidate.student.email}</h2><p className="text-sm text-ink-3">{candidate.drive?.companyName} · {candidate.drive?.role}</p></div><Tag>{titleCase(candidate.proctorStatus)}</Tag></button>)}</QueryState><Dialog open={!!selected} onOpenChange={() => setSelected(null)} title="Candidate assessment">{selected && <ActionForm fields={[{ name: 'proctorStatus', label: 'Verification status', type: 'select', required: true, options: options(['NOT_STARTED', 'IN_PROGRESS', 'CLEARED', 'FLAGGED', 'DISQUALIFIED']) }, { name: 'assessmentScore', label: 'Score (%)', type: 'number', min: 0, max: 100 }, { name: 'proctorNotes', label: 'Assessment notes', type: 'textarea' }]} initial={{ proctorStatus: selected.proctorStatus, assessmentScore: selected.assessmentScore == null ? '' : String(selected.assessmentScore), proctorNotes: selected.proctorNotes ?? '' }} onSubmit={async values => { await api.patch(`/placements/proctor/candidates/${selected.id}`, { ...values, assessmentScore: values.assessmentScore ? Number(values.assessmentScore) : undefined }); setSelected(null); await query.refetch(); toast.done('Assessment updated'); }} />}</Dialog></Page>;
}
