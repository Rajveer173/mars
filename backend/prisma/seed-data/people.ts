// The institute and everyone in it. All of it is fictional: the domain uses the
// reserved .example TLD, so no address here can ever reach a real mailbox.

export const EMAIL_DOMAIN = 'meridian.example';
/** One shared password for every seeded account. Demo data only. */
export const DEMO_PASSWORD = 'Meridian#2026';

export const ORG = {
  name: 'Meridian Institute of Technology',
  slug: 'meridian',
  description:
    'A fictional engineering college used for demonstrations: three departments, one active academic year and four core computer-science courses.',
  brandColor: '#0f4c5c',
  settings: { timezone: 'Asia/Kolkata', gradingScale: '10-point', passPercentage: 40, attendanceThreshold: 75 },
};

export interface SeedDepartment {
  code: 'CSE' | 'IT' | 'ECE';
  name: string;
  /** Canonical branch name used by placement eligibility (src/utils/branches.ts). */
  branch: string;
}

export const DEPARTMENTS: SeedDepartment[] = [
  { code: 'CSE', name: 'Computer Science & Engineering', branch: 'Computer Science' },
  { code: 'IT', name: 'Information Technology', branch: 'Information Technology' },
  { code: 'ECE', name: 'Electronics & Communication', branch: 'Electronics & Communication' },
];

export const ACADEMIC_YEAR = {
  name: 'Academic Year 2026-27',
  semesters: ['Semester 7 (Odd)', 'Semester 8 (Even)'],
  batchStartYear: 2023,
  batchEndYear: 2027,
};

export interface SeedStaff {
  /** Also the local part of the e-mail address, with "_" written as ".". */
  username: string;
  fullName: string;
  role: 'ADMIN' | 'ORG_ADMIN' | 'PROCTOR' | 'TEACHER';
  qualification?: string;
  orgRole: 'ADMIN' | 'MEMBER';
}

export const STAFF: SeedStaff[] = [
  { username: 'admin', fullName: 'Vikram Nair', role: 'ADMIN', orgRole: 'ADMIN' },
  { username: 'orgadmin', fullName: 'Dr. Sunita Rao', role: 'ORG_ADMIN', qualification: 'Ph.D., Electronics; Dean of Academics', orgRole: 'ADMIN' },
  { username: 'proctor', fullName: 'Imran Qureshi', role: 'PROCTOR', qualification: 'Examination Cell', orgRole: 'MEMBER' },
  { username: 'teacher', fullName: 'Dr. Ananya Krishnan', role: 'TEACHER', qualification: 'Ph.D., Computer Science (Database Systems)', orgRole: 'MEMBER' },
  { username: 'rohit_deshpande', fullName: 'Prof. Rohit Deshpande', role: 'TEACHER', qualification: 'M.Tech., Computer Networks', orgRole: 'MEMBER' },
  { username: 'meera_pillai', fullName: 'Dr. Meera Pillai', role: 'TEACHER', qualification: 'Ph.D., Algorithms', orgRole: 'MEMBER' },
  { username: 'farhan_siddiqui', fullName: 'Prof. Farhan Siddiqui', role: 'TEACHER', qualification: 'M.Tech., Communication Systems; Training and Placement Officer', orgRole: 'MEMBER' },
];

/** The teacher who runs placement training and owns the mixed aptitude bank. */
export const PLACEMENT_OFFICER = 'farhan_siddiqui';

export const PRIMARY_STUDENT = {
  username: 'student',
  fullName: 'Aarav Menon',
  dept: 'CSE' as const,
  /**
   * Share of questions on each topic that he answers correctly. Topics not
   * listed use `defaultStrength`. The pattern is deliberate, so a study-plan
   * feature has something real to find: strong in DSA and DBMS normalisation,
   * weak in OS deadlocks and memory management and in the Networks transport
   * layer. The seed applies these shares exactly rather than by chance.
   */
  defaultStrength: 0.86,
  topicStrength: {
    // CS201: strong throughout
    'Complexity Analysis': 0.94,
    'Stacks and Queues': 0.94,
    Hashing: 0.92,
    'Binary Search Trees': 0.94,
    'AVL Trees': 0.9,
    Heaps: 0.92,
    'Graph Traversal': 0.94,
    'Shortest Paths': 0.9,
    'Dynamic Programming': 0.9,
    // CS301: strong in schema design
    'Functional Dependencies': 0.95,
    Normalisation: 0.96,
    'BCNF and Lossless Decomposition': 0.93,
    // CS302: weak in deadlocks and memory management
    'Deadlock Conditions': 0.35,
    'Banker\'s Algorithm': 0.25,
    'Deadlock Detection and Recovery': 0.3,
    'Memory Allocation and Fragmentation': 0.4,
    'Paging and TLB': 0.3,
    'Virtual Memory and Page Replacement': 0.3,
    // CS303: weak in the transport layer
    'UDP and Multiplexing': 0.4,
    'TCP Connection Management': 0.28,
    'TCP Congestion Control': 0.25,
  } as Record<string, number>,
  /** Lessons completed per course code: 22 of 36, about 60 percent. */
  lessonsCompleted: { CS301: 7, CS302: 4, CS303: 4, CS201: 7 } as Record<string, number>,
  placement: { cgpa: 8.31, tenthPercentage: 92.4, twelfthPercentage: 89.5, activeBacklogs: 0, skills: ['Java', 'Python', 'SQL', 'Data Structures & Algorithms', 'React'] },
};

/** 35 classmates; with the primary student that makes 36: 14 CSE, 12 IT, 10 ECE. */
export const STUDENT_NAMES: Record<'CSE' | 'IT' | 'ECE', string[]> = {
  CSE: [
    'Diya Sharma', 'Kabir Singh', 'Ishita Banerjee', 'Rohan Iyer', 'Sneha Kulkarni', 'Arjun Reddy', 'Tanvi Joshi',
    'Mohammed Faizan', 'Nandini Hegde', 'Varun Malhotra', 'Priya Nambiar', 'Siddharth Ghosh', 'Lakshmi Venkatesan',
  ],
  IT: [
    'Aditya Verma', 'Pooja Patil', 'Karthik Subramanian', 'Riya Chatterjee', 'Harsh Agarwal', 'Ayesha Khan',
    'Nikhil Bhatt', 'Shruti Desai', 'Gurpreet Kaur', 'Manoj Yadav', 'Anjali Mishra', 'Joseph Mathew',
  ],
  ECE: [
    'Vivek Chauhan', 'Meghana Rao', 'Sameer Shaikh', 'Kavya Gowda', 'Rahul Saxena', 'Divya Thakur', 'Tenzin Dorjee',
    'Bhavna Solanki', 'Pranav Kapoor', 'Zoya Fernandes',
  ],
};

/** Courses a student of each department takes: always, and sometimes (with that probability). */
export const ENROLMENT_RULES: Record<'CSE' | 'IT' | 'ECE', { always: string[]; maybe: [string, number][] }> = {
  CSE: { always: ['CS301', 'CS302', 'CS201'], maybe: [['CS303', 0.75]] },
  IT: { always: ['CS301', 'CS303', 'CS201'], maybe: [['CS302', 0.5]] },
  ECE: { always: ['CS303', 'CS201'], maybe: [['CS302', 0.4]] },
};

export const SKILLS: Record<'CSE' | 'IT' | 'ECE', string[]> = {
  CSE: ['Java', 'Python', 'C++', 'SQL', 'Data Structures & Algorithms', 'React', 'Node.js', 'Docker', 'Git', 'Operating Systems'],
  IT: ['Java', 'Spring Boot', 'SQL', 'JavaScript', 'Angular', 'AWS', 'Linux', 'Python', 'REST APIs', 'Git'],
  ECE: ['C', 'Embedded C', 'Verilog', 'MATLAB', 'Python', 'Signal Processing', 'ARM Cortex-M', 'PCB Design', 'C++', 'IoT'],
};

export const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0',
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
];
