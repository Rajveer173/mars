// Placement drives. Every company is invented; any resemblance to a real
// employer is accidental. Branch names are the canonical ones from
// src/utils/branches.ts so eligibility checks match student profiles.

export const PLACEMENT_BATCH_YEAR = 2027;

export interface SeedDrive {
  key: string;
  companyName: string;
  role: string;
  description: string;
  driveType: 'ON_CAMPUS' | 'OFF_CAMPUS';
  eligibilityCgpa: number;
  /** Empty means every branch is eligible. */
  eligibleBranches: string[];
  maxBacklogs: number;
  minTenthPercent: number | null;
  minTwelfthPercent: number | null;
  ctcLpa: number;
  location: string;
  /** Days from today; negative is in the past. */
  deadlineInDays: number;
  driveInDays: number;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  selectionProcess: string[];
  createdBy: 'admin' | 'officer';
}

const ROUNDS = ['Resume Screening', 'Online Assessment', 'Technical Interview', 'HR Round'];

export const DRIVES: SeedDrive[] = [
  {
    key: 'northwind',
    companyName: 'Northwind Systems',
    role: 'Software Engineer (New Grad)',
    description:
      'Build and operate distributed backend services for a logistics platform. Expect questions on data structures, operating systems and database design.\n\nRounds: online assessment, two technical interviews, one HR discussion.',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: 8.0,
    eligibleBranches: ['Computer Science', 'Information Technology', 'Electronics & Communication'],
    maxBacklogs: 0,
    minTenthPercent: 75,
    minTwelfthPercent: 75,
    ctcLpa: 18.5,
    location: 'Bengaluru / Hybrid',
    deadlineInDays: 14,
    driveInDays: 21,
    status: 'ACTIVE',
    selectionProcess: ROUNDS,
    createdBy: 'admin',
  },
  {
    key: 'halcyon',
    companyName: 'Halcyon Labs',
    role: 'Software Development Engineer',
    description:
      'Cloud-native services, high-throughput APIs and developer tooling.\n\nRounds: coding test, system-design discussion, two interviews.',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: 7.5,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    maxBacklogs: 0,
    minTenthPercent: 70,
    minTwelfthPercent: 70,
    ctcLpa: 24.0,
    location: 'Hyderabad / On-site',
    deadlineInDays: 21,
    driveInDays: 28,
    status: 'ACTIVE',
    selectionProcess: ['Resume Screening', 'Online Assessment', 'System Design Round', 'Technical Interview', 'HR Round'],
    createdBy: 'officer',
  },
  {
    key: 'kestrel',
    companyName: 'Kestrel Analytics',
    role: 'Data Engineer - Off Campus Hiring',
    description:
      'Open hiring drive for the 2027 batch. Strong SQL, problem solving and computer-science fundamentals are expected.',
    driveType: 'OFF_CAMPUS',
    eligibilityCgpa: 6.5,
    eligibleBranches: ['Computer Science', 'Information Technology', 'Electronics & Communication', 'Electrical', 'Mechanical'],
    maxBacklogs: 1,
    minTenthPercent: 60,
    minTwelfthPercent: 60,
    ctcLpa: 12.0,
    location: 'Multiple locations / Remote',
    deadlineInDays: 30,
    driveInDays: 36,
    status: 'ACTIVE',
    selectionProcess: ROUNDS,
    createdBy: 'admin',
  },
  {
    key: 'ironbark',
    companyName: 'Ironbark Capital Technologies',
    role: 'Analyst - Engineering (Strats)',
    description:
      'Quantitative engineering for trading desks. Requires an excellent academic record and strong probability and algorithms.',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: 9.0, // The primary demo student (8.31) is ineligible: shows the CGPA reason.
    eligibleBranches: ['Computer Science', 'Information Technology'],
    maxBacklogs: 0,
    minTenthPercent: 85,
    minTwelfthPercent: 85,
    ctcLpa: 22.0,
    location: 'Mumbai / On-site',
    deadlineInDays: 10,
    driveInDays: 15,
    status: 'ACTIVE',
    selectionProcess: ['Resume Screening', 'Online Assessment', 'Quant Interview', 'Technical Interview', 'HR Round'],
    createdBy: 'admin',
  },
  {
    key: 'tessellate',
    companyName: 'Tessellate Robotics',
    role: 'Graduate Engineer Trainee (Embedded Systems)',
    description:
      'One-year rotational programme across firmware, controls and hardware validation for core engineering graduates.',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: 6.0,
    eligibleBranches: ['Electronics & Communication', 'Electrical', 'Mechanical'], // Primary student ineligible by branch.
    maxBacklogs: 0,
    minTenthPercent: 60,
    minTwelfthPercent: 60,
    ctcLpa: 7.5,
    location: 'Pune / On-site',
    deadlineInDays: 40,
    driveInDays: 48,
    status: 'UPCOMING',
    selectionProcess: ['Resume Screening', 'Aptitude Test', 'Technical Interview', 'HR Round'],
    createdBy: 'officer',
  },
  {
    key: 'quillon',
    companyName: 'Quillon Consulting',
    role: 'Analyst - Technology Consulting',
    description: 'Consulting analyst role. Applications closed two days ago; shortlisting is in progress.',
    driveType: 'OFF_CAMPUS',
    eligibilityCgpa: 6.5,
    eligibleBranches: [],
    maxBacklogs: 2,
    minTenthPercent: 60,
    minTwelfthPercent: 60,
    ctcLpa: 8.0,
    location: 'Gurugram / Hybrid',
    deadlineInDays: -2, // Still ACTIVE but past the deadline: shows "deadline has passed".
    driveInDays: 5,
    status: 'ACTIVE',
    selectionProcess: ['Resume Screening', 'Online Assessment', 'Case Interview', 'HR Round'],
    createdBy: 'admin',
  },
  {
    key: 'bluepeak',
    companyName: 'Bluepeak Cloud',
    role: 'Systems Engineer (Specialist Programmer)',
    description: 'Mass recruitment drive open to all branches. Results announced.',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: 6.0,
    eligibleBranches: [],
    maxBacklogs: 1,
    minTenthPercent: 60,
    minTwelfthPercent: 60,
    ctcLpa: 9.5,
    location: 'Mysuru / On-site',
    deadlineInDays: -45,
    driveInDays: -35,
    status: 'COMPLETED',
    selectionProcess: ROUNDS,
    createdBy: 'admin',
  },
  {
    key: 'saffron',
    companyName: 'Saffron Grid Software',
    role: 'Member Technical Staff',
    description: 'Drive cancelled by the company because of a hiring freeze.',
    driveType: 'ON_CAMPUS',
    eligibilityCgpa: 7.0,
    eligibleBranches: ['Computer Science', 'Information Technology'],
    maxBacklogs: 0,
    minTenthPercent: null,
    minTwelfthPercent: null,
    ctcLpa: 12.0,
    location: 'Chennai / On-site',
    deadlineInDays: 7,
    driveInDays: 12,
    status: 'CANCELLED',
    selectionProcess: ROUNDS,
    createdBy: 'officer',
  },
];

/** Selection round and proctor verdict that follow from an application status. */
export const APPLICATION_PROGRESS: Record<string, { currentRound: string; proctorStatus: string; scored: boolean }> = {
  APPLIED: { currentRound: 'Resume Screening', proctorStatus: 'NOT_STARTED', scored: false },
  SHORTLISTED: { currentRound: 'Online Assessment', proctorStatus: 'IN_PROGRESS', scored: true },
  INTERVIEWED: { currentRound: 'Technical Interview', proctorStatus: 'CLEARED', scored: true },
  SELECTED: { currentRound: 'Offer Released', proctorStatus: 'CLEARED', scored: true },
  REJECTED: { currentRound: 'Technical Interview', proctorStatus: 'CLEARED', scored: true },
};

export const APPLICATION_NOTES: Record<string, (string | null)[]> = {
  APPLIED: [null],
  SHORTLISTED: ['Online assessment cleared.', 'Shortlisted on resume and assessment score.', null],
  INTERVIEWED: ['Technical rounds done; awaiting the hiring committee.', 'Strong on data structures; database round was average.', null],
  SELECTED: ['Offer letter issued.', 'Offer accepted.'],
  REJECTED: ['Did not clear the technical interview.', 'Assessment score below the cut-off.'],
};

/** The primary demo student's applications: [drive key, status, notes]. */
export const PRIMARY_APPLICATIONS: [string, string, string | null][] = [
  ['northwind', 'SHORTLISTED', 'Cleared the online assessment with a top-10 score.'],
  ['kestrel', 'APPLIED', null],
  ['bluepeak', 'SELECTED', 'Offer letter issued: Specialist Programmer, 9.5 LPA.'],
];
