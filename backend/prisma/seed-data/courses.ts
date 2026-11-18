import type { SeedModule, SeedQuestion } from './types.js';
import { DBMS_MODULES } from './lessons-dbms.js';
import { OS_MODULES } from './lessons-os.js';
import { NETWORKS_MODULES } from './lessons-networks.js';
import { DSA_MODULES } from './lessons-dsa.js';
import { DBMS_QUESTIONS } from './questions-dbms.js';
import { OS_QUESTIONS } from './questions-os.js';
import { NETWORKS_QUESTIONS } from './questions-networks.js';
import { DSA_QUESTIONS } from './questions-dsa.js';

export interface SeedCourse {
  code: string;
  name: string;
  description: string;
  category: string;
  /** Username of the teacher who owns the course content. */
  teacher: string;
  modules: SeedModule[];
  questions: SeedQuestion[];
}

export const COURSES: SeedCourse[] = [
  {
    code: 'CS301',
    name: 'Database Management Systems',
    description:
      'Relational modelling, SQL, schema design through normalisation, transaction processing and B+ tree indexing, with worked examples for every technique.',
    category: 'Computer Science',
    teacher: 'teacher',
    modules: DBMS_MODULES,
    questions: DBMS_QUESTIONS,
  },
  {
    code: 'CS302',
    name: 'Operating Systems',
    description:
      'Processes and threads, CPU scheduling, synchronisation, deadlocks and memory management, with worked numerical examples for every algorithm.',
    category: 'Computer Science',
    teacher: 'teacher',
    modules: OS_MODULES,
    questions: OS_QUESTIONS,
  },
  {
    code: 'CS303',
    name: 'Computer Networks',
    description:
      'The layered Internet architecture from IP addressing and routing through TCP and UDP to DNS, HTTP and TLS.',
    category: 'Computer Science',
    teacher: 'rohit_deshpande',
    modules: NETWORKS_MODULES,
    questions: NETWORKS_QUESTIONS,
  },
  {
    code: 'CS201',
    name: 'Data Structures and Algorithms',
    description:
      'Complexity analysis, linear structures, hashing, search trees, heaps, graph algorithms and dynamic programming, with coding practice.',
    category: 'Computer Science',
    teacher: 'meera_pillai',
    modules: DSA_MODULES,
    questions: DSA_QUESTIONS,
  },
];
