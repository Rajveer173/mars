// Everything around the courses: test titles, announcements, discussion
// threads, assignments, coding problems and the notifications shown to the demo
// accounts. Short strings here must fit a VARCHAR(191) column unless noted.

export const testTitle = {
  quiz1: (code: string) => `${code} Quiz 1`,
  midterm: (code: string) => `${code} Midterm Examination`,
  practice: (code: string) => `${code} Practice Test`,
  quiz2: (code: string) => `${code} Quiz 2`,
  final: (code: string) => `${code} End-Semester Examination`,
};

/* ---------------------------------------------------------- announcements */

export interface SeedAnnouncement {
  title: string;
  message: string;
  pinned: boolean;
  daysAgo: number;
}

export const ANNOUNCEMENTS: Record<string, SeedAnnouncement[]> = {
  CS301: [
    { title: 'Welcome to CS301', pinned: true, daysAgo: 96, message: 'Welcome to Database Management Systems. Work through Module 1 before Quiz 1; every lesson ends with the mistakes that cost marks most often, so read those sections twice.' },
    { title: 'Midterm results published', pinned: false, daysAgo: 6, message: 'Midterm results are out. The class did well on normalisation and noticeably worse on isolation levels and B+ tree arithmetic. Revise Module 3 before the practice test closes.' },
    { title: 'Quiz 2 opens in three days', pinned: false, daysAgo: 1, message: 'Quiz 2 covers Module 3: transactions, isolation levels and B+ tree indexing. It is open for 24 hours, one attempt, 0.25 negative marking per wrong objective answer.' },
  ],
  CS302: [
    { title: 'Welcome to CS302', pinned: true, daysAgo: 96, message: 'Welcome to Operating Systems. Almost every topic here has a numerical: Gantt charts, the Banker\'s algorithm, page-replacement traces. Practise them on paper, not just by reading.' },
    { title: 'Revision session on deadlocks', pinned: false, daysAgo: 5, message: 'Many midterm answers confused deadlock prevention with avoidance and used Max instead of Need in the Banker\'s algorithm. There is a revision session on Friday at 4 pm in Lab 2; bring the Module 2 worked examples.' },
    { title: 'Practice test on memory management is open', pinned: false, daysAgo: 2, message: 'The Module 3 practice test is open for a week and allows three attempts. Use it to check paging, TLB and page-replacement calculations before Quiz 2.' },
  ],
  CS303: [
    { title: 'Welcome to CS303', pinned: true, daysAgo: 96, message: 'Welcome to Computer Networks. We go up the stack: addressing and routing first, then the transport layer, then DNS, HTTP and TLS.' },
    { title: 'Midterm feedback: transport layer', pinned: false, daysAgo: 6, message: 'The weakest area in the midterm was the transport layer: sequence and acknowledgement numbers, and the difference between a timeout and three duplicate ACKs. Re-read Module 2 and redo both worked examples.' },
    { title: 'Packet-capture lab moved', pinned: false, daysAgo: 3, message: 'The packet-capture lab for the TCP handshake assignment moves to Thursday 2 pm because of the placement talk. Bring a laptop with a capture tool installed.' },
  ],
  CS201: [
    { title: 'Welcome to CS201', pinned: true, daysAgo: 96, message: 'Welcome to Data Structures and Algorithms. Every module has coding problems in the practice section; solving them is the best preparation for placement tests.' },
    { title: 'Midterm results and merit certificates', pinned: false, daysAgo: 6, message: 'Midterm results are published and merit certificates have been issued to the top three scorers. Solutions to the AVL and heap questions are discussed in the forum.' },
    { title: 'Coding practice before Quiz 2', pinned: false, daysAgo: 1, message: 'Quiz 2 covers graphs, shortest paths and dynamic programming. Attempt the Coin Change problem first; the greedy solution fails one of its test cases, and you should understand why.' },
  ],
};

/* ------------------------------------------------------------ discussions */

export interface SeedThread {
  question: string;
  replies: { by: 'teacher' | 'student'; content: string }[];
}

export const DISCUSSIONS: Record<string, SeedThread[]> = {
  CS301: [
    {
      question: 'In the Teaching(student, course, instructor) example, why is the relation in 3NF if instructor -> course is clearly a problem?',
      replies: [
        { by: 'teacher', content: '3NF allows a dependency X -> A when A is a prime attribute. The candidate keys are (student, course) and (student, instructor), so course is prime and the dependency is tolerated. BCNF has no such exception: instructor is not a super key, so BCNF is violated.' },
        { by: 'student', content: 'So after the BCNF split we lose student, course -> instructor as a single-table constraint? That is the dependency-preservation trade-off, right?' },
        { by: 'teacher', content: 'Exactly. The split is lossless because instructor is a key of (instructor, course), but that dependency can now only be checked with a join.' },
      ],
    },
    {
      question: 'Is REPEATABLE READ enough to stop phantoms? I thought MySQL does not show phantoms at that level.',
      replies: [
        { by: 'teacher', content: 'By the SQL standard, REPEATABLE READ still permits phantoms; only SERIALIZABLE forbids them. Individual products can be stricter than the standard. In an exam, answer by the standard table unless the question names a product.' },
        { by: 'student', content: 'That clears it up. The difference from a non-repeatable read is that a phantom changes the set of rows, not an existing row.' },
      ],
    },
  ],
  CS302: [
    {
      question: 'In the Banker\'s algorithm example, why is the request of P0 for (0, 2, 0) refused when Available is (2, 3, 0)? The resources are free.',
      replies: [
        { by: 'teacher', content: 'Free is not the same as safe. After a trial allocation Available becomes (2, 1, 0). P1 still needs 2 of B and P3 needs 1 of C, so no process can finish and no safe sequence exists. The algorithm refuses any request that leaves an unsafe state.' },
        { by: 'student', content: 'And an unsafe state is not necessarily a deadlock, it just might become one?' },
        { by: 'teacher', content: 'Correct. Avoidance is conservative: it stays away from every state that could lead to deadlock.' },
      ],
    },
    {
      question: 'For the effective access time with a TLB, do we add the TLB lookup time on a miss as well?',
      replies: [
        { by: 'teacher', content: 'Yes. A miss pays for the TLB lookup, the page-table access and the memory access: 10 + 100 + 100 = 210 ns in the lesson example. A hit pays 10 + 100 = 110 ns. With a 90 percent hit ratio that gives 120 ns.' },
      ],
    },
  ],
  CS303: [
    {
      question: 'Why is the acknowledgement 1001 and not 1000 after a SYN with sequence number 1000? The SYN carries no data.',
      replies: [
        { by: 'teacher', content: 'A SYN consumes one sequence number even though it carries no data, and so does a FIN. The acknowledgement number is always the next byte expected, so it is 1001.' },
        { by: 'student', content: 'So the first data byte from the client is numbered 1001, and 200 bytes of data are acknowledged with 1201.' },
      ],
    },
    {
      question: 'In TCP Reno, what exactly is different between a timeout and three duplicate ACKs?',
      replies: [
        { by: 'teacher', content: 'Both set ssthresh to half of the current cwnd. After a timeout cwnd returns to 1 MSS and slow start begins again. After three duplicate ACKs Reno sets cwnd to the new ssthresh and continues in congestion avoidance, because duplicate ACKs prove that later segments are still getting through.' },
      ],
    },
  ],
  CS201: [
    {
      question: 'Why is building a heap O(n) when each sift-down is O(log n) and we do about n / 2 of them?',
      replies: [
        { by: 'teacher', content: 'The log n bound is only reached at the root. Half of the internal nodes are one level above the leaves and move at most one step, a quarter move at most two, and so on. The sum n/4 x 1 + n/8 x 2 + n/16 x 3 + ... converges to a constant times n.' },
        { by: 'student', content: 'That also explains why inserting n elements one by one is worse: most insertions start at the bottom and can travel the full height.' },
      ],
    },
    {
      question: 'For the coin change problem with coins 1, 3 and 4 and amount 6, my greedy solution prints 3. Is the expected output wrong?',
      replies: [
        { by: 'teacher', content: 'The expected output, 2, is right: 3 + 3. Greedy takes 4 first and is then forced into 1 + 1. Use dp[a] = 1 + min(dp[a - c]) over all coins c, with dp[0] = 0.' },
      ],
    },
  ],
};

/* ------------------------------------------------------------ assignments */

export interface SeedAssignment {
  title: string;
  description: string;
  maxMarks: number;
  /** Days from today; negative means the deadline has passed. */
  dueInDays: number;
  /** A typical submission summary, stored as the student's answer text. */
  sampleAnswer: string;
}

export const ASSIGNMENTS: Record<string, SeedAssignment[]> = {
  CS301: [
    { title: 'Normalise a library schema to BCNF', maxMarks: 20, dueInDays: -10, description: 'You are given one wide Loan relation with member, book, branch and loan attributes and its functional dependencies. Find all candidate keys, state the highest normal form, and decompose to BCNF. Say whether your decomposition is lossless and dependency preserving.', sampleAnswer: 'Candidate key found with attribute closure: (member_id, book_id, loan_date). Removed the partial dependencies on member_id and book_id, then the transitive dependency through branch_id. The final five relations are in BCNF and the join is lossless.' },
    { title: 'Isolation levels in practice', maxMarks: 20, dueInDays: 6, description: 'Using two database sessions, reproduce a dirty read, a non-repeatable read and a phantom read, and record the lowest isolation level at which each disappears. Submit the SQL of both sessions and a short explanation.', sampleAnswer: 'Reproduced the non-repeatable read at READ COMMITTED with two sessions on the account table; it disappeared at REPEATABLE READ. The phantom needed a range query with an insert from the second session.' },
  ],
  CS302: [
    { title: 'CPU scheduling simulator', maxMarks: 25, dueInDays: -10, description: 'Write a program that reads arrival and burst times and prints the Gantt chart, per-process waiting and turnaround times and the averages for FCFS, SJF, SRTF and Round Robin with a configurable quantum.', sampleAnswer: 'Implemented FCFS, SJF, SRTF and Round Robin. On the lesson data set the average waiting times are 4.75, 4.0 and 3.0 for FCFS, SJF and SRTF. Round Robin with quantum 2 is included with its Gantt chart.' },
    { title: 'Banker\'s algorithm and deadlock detection', maxMarks: 25, dueInDays: 6, description: 'Implement the safety algorithm and the resource-request algorithm. For each request in the supplied trace, print whether it is granted and the safe sequence found. Then adapt the code into the detection algorithm.', sampleAnswer: 'Safety check and request handling implemented with Need = Max - Allocation. The request trace grants P1 (1,0,2) and refuses P0 (0,2,0). Detection variant uses the Request matrix.' },
  ],
  CS303: [
    { title: 'Subnet design for a campus', maxMarks: 20, dueInDays: -10, description: 'Starting from 172.20.0.0/22, design subnets for five departments needing 200, 120, 60, 28 and 12 hosts and three point-to-point links. Give the network address, prefix, usable range and broadcast address of every subnet.', sampleAnswer: 'Allocated largest first with VLSM: /24 for 200 hosts, /25 for 120, /26 for 60, /27 for 28, /28 for 12, and three /30 links. Table of network, range and broadcast addresses attached.' },
    { title: 'TCP handshake and congestion trace', maxMarks: 20, dueInDays: 6, description: 'Capture one HTTPS page load. Identify the three-way handshake with its sequence and acknowledgement numbers, the TLS handshake and the connection close. Plot the sender window over time and mark slow start.', sampleAnswer: 'Capture attached. The handshake segments are annotated with relative sequence numbers; the TLS 1.3 handshake completes in one round trip. The window plot shows slow start for the first four round trips.' },
  ],
  CS201: [
    { title: 'Hash table with open addressing', maxMarks: 20, dueInDays: -10, description: 'Implement a hash table with linear probing, tombstone deletion and rehashing when the load factor passes 0.7. Report the average number of probes for successful and unsuccessful searches at load factors 0.3, 0.5, 0.7 and 0.9.', sampleAnswer: 'Linear probing with tombstones and rehashing at load factor 0.7. Measured average probes rise sharply above 0.7, which matches primary clustering. Results table and code attached.' },
    { title: 'Shortest paths on a city map', maxMarks: 20, dueInDays: 6, description: 'Implement Dijkstra with a binary heap on the supplied road graph and print the shortest route between two junctions. Then add one negative edge, show the wrong answer, and fix it with Bellman-Ford.', sampleAnswer: 'Dijkstra with a binary heap and lazy deletion of stale entries. Routes verified on the sample map. Bellman-Ford section in progress.' },
  ],
};

/** Teacher feedback by score band (fraction of maximum marks). */
export const FEEDBACK: { min: number; text: string[] }[] = [
  { min: 0.85, text: ['Excellent work: correct, complete and clearly explained.', 'Very well done. The reasoning for each step is easy to follow.'] },
  { min: 0.65, text: ['Good submission. One step is missing its justification; see the comments on the second part.', 'Mostly correct. Check the edge case discussed in the lesson\'s common-mistakes section.'] },
  { min: 0.45, text: ['The main idea is right but the working has errors. Redo the worked example from the lesson and compare.', 'Partially correct. The final answer does not follow from your intermediate results.'] },
  { min: 0, text: ['This needs to be redone. Please revise the lesson and come to office hours.', 'Incomplete submission; several required parts are missing.'] },
];

/** Course reviews by star rating. */
export const REVIEWS: Record<number, string[]> = {
  5: ['The worked examples make the numericals easy to follow.', 'Clear notes and the common-mistakes sections saved me marks in the midterm.', 'Best-organised course this semester.'],
  4: ['Good content. I would like more practice questions per lesson.', 'Lessons are precise and to the point; the quizzes are fair.', 'Useful for placement preparation.'],
  3: ['Content is fine but the pace of the third module is fast.', 'Decent course; some topics need more examples.'],
  2: ['Too much material before the midterm.'],
};

/* -------------------------------------------------------- coding problems */

export interface SeedCodingProblem {
  key: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  description: string;
  /** [stdin, expected stdout]; the first two are public. */
  cases: [string, string][];
  /** Reference solution in Python. */
  solution: string;
}

export const CODING_PROBLEMS: SeedCodingProblem[] = [
  {
    key: 'two-sum',
    title: 'Two Sum',
    difficulty: 'EASY',
    description:
      'Given n integers and a target, print the 0-based indexes i and j (i < j) of the two numbers that add up to the target. Exactly one such pair exists.\n\nInput: the first line has n and the target; the second line has n integers.\nOutput: i and j separated by a space.\n\nAim for O(n) time using a hash table.',
    cases: [['4 9\n2 7 11 15\n', '0 1'], ['3 6\n3 2 4\n', '1 2'], ['2 6\n3 3\n', '0 1'], ['5 16\n1 5 3 7 9\n', '3 4']],
    solution: `import sys

def main():
    data = sys.stdin.read().split()
    n, target = int(data[0]), int(data[1])
    nums = [int(x) for x in data[2:2 + n]]
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            print(seen[target - x], i)
            return
        seen[x] = i

main()
`,
  },
  {
    key: 'valid-parentheses',
    title: 'Valid Parentheses',
    difficulty: 'EASY',
    description:
      'A string contains only the characters ( ) [ ] { }. Print true if every bracket is closed by the same type of bracket in the correct order, otherwise print false.\n\nInput: one line containing the string.\nOutput: true or false.\n\nUse a stack.',
    cases: [['()[]{}\n', 'true'], ['([)]\n', 'false'], ['{[()]}\n', 'true'], ['((\n', 'false']],
    solution: `import sys

def balanced(text):
    pairs = {')': '(', ']': '[', '}': '{'}
    stack = []
    for ch in text:
        if ch in '([{':
            stack.append(ch)
        elif ch in pairs:
            if not stack or stack.pop() != pairs[ch]:
                return False
    return not stack

print('true' if balanced(sys.stdin.readline().strip()) else 'false')
`,
  },
  {
    key: 'binary-search',
    title: 'Binary Search',
    difficulty: 'MEDIUM',
    description:
      'Given a sorted array of n distinct integers and a target, print the 0-based index of the target, or -1 if it is absent.\n\nInput: the first line has n and the target; the second line has the n sorted integers.\nOutput: one integer.\n\nYour solution must run in O(log n) time.',
    cases: [['6 9\n-1 0 3 5 9 12\n', '4'], ['6 2\n-1 0 3 5 9 12\n', '-1'], ['1 5\n5\n', '0'], ['5 20\n1 4 7 9 12\n', '-1']],
    solution: `import sys

def main():
    data = sys.stdin.read().split()
    n, target = int(data[0]), int(data[1])
    nums = [int(x) for x in data[2:2 + n]]
    lo, hi = 0, n - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            print(mid)
            return
        if nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    print(-1)

main()
`,
  },
  {
    key: 'coin-change',
    title: 'Coin Change',
    difficulty: 'HARD',
    description:
      'Given n coin values and an amount, print the minimum number of coins needed to make the amount, or -1 if it cannot be made. Each coin may be used any number of times.\n\nInput: the first line has n and the amount; the second line has the n coin values.\nOutput: one integer.\n\nA greedy choice of the largest coin is not always optimal; use dynamic programming.',
    cases: [['3 6\n1 3 4\n', '2'], ['3 11\n1 2 5\n', '3'], ['1 3\n2\n', '-1'], ['3 0\n1 2 5\n', '0']],
    solution: `import sys

def main():
    data = sys.stdin.read().split()
    n, amount = int(data[0]), int(data[1])
    coins = [int(x) for x in data[2:2 + n]]
    INF = float('inf')
    dp = [0] + [INF] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a and dp[a - c] + 1 < dp[a]:
                dp[a] = dp[a - c] + 1
    print(dp[amount] if dp[amount] != INF else -1)

main()
`,
  },
];

const TWO_SUM_JS = `const lines = require('fs').readFileSync(0, 'utf8').trim().split('\\n');
const [n, target] = lines[0].split(' ').map(Number);
const nums = lines[1].split(' ').map(Number).slice(0, n);
const seen = new Map();
for (let i = 0; i < nums.length; i += 1) {
  if (seen.has(target - nums[i])) {
    console.log(seen.get(target - nums[i]) + ' ' + i);
    break;
  }
  seen.set(nums[i], i);
}
`;

// Missing semicolon on the HashMap line: javac rejects it, so nothing runs.
const TWO_SUM_JAVA_BROKEN = `import java.util.*;

public class solution {
    public static void main(String[] args) {
        Scanner in = new Scanner(System.in);
        int n = in.nextInt(), target = in.nextInt();
        int[] nums = new int[n];
        for (int i = 0; i < n; i++) nums[i] = in.nextInt();
        Map<Integer, Integer> seen = new HashMap<>()
        for (int i = 0; i < n; i++) {
            if (seen.containsKey(target - nums[i])) {
                System.out.println(seen.get(target - nums[i]) + " " + i);
                return;
            }
            seen.put(nums[i], i);
        }
    }
}
`;

const PARENS_COUNT_ONLY = `import sys

text = sys.stdin.readline().strip()
ok = text.count('(') == text.count(')') and text.count('[') == text.count(']') and text.count('{') == text.count('}')
print('true' if ok else 'false')
`;

const BINARY_SEARCH_LINEAR = `import sys

data = sys.stdin.read().split()
n, target = int(data[0]), int(data[1])
nums = [int(x) for x in data[2:2 + n]]
print(nums.index(target) if target in nums else -1)
`;

const BINARY_SEARCH_BROKEN = `import sys

data = sys.stdin.read().split()
n, target = int(data[0]), int(data[1])
nums = [int(x) for x in data[2:2 + n]]
lo, hi = 0, n
while lo <= hi:
    mid = (lo + hi) // 2
    if nums[mid] == target:
        print(mid)
        break
    if nums[mid] < target:
        lo = mid + 1
    else:
        hi = mid - 1
else:
    print(-1)
`;

const COIN_CHANGE_GREEDY = `import sys

data = sys.stdin.read().split()
n, amount = int(data[0]), int(data[1])
coins = sorted((int(x) for x in data[2:2 + n]), reverse=True)
count = 0
for c in coins:
    count += amount // c
    amount %= c
print(count if amount == 0 else -1)
`;

export interface SeedCodeSubmission {
  problem: string;
  /** Username, or 'student' for the primary demo student. */
  by: string;
  language: 'python' | 'javascript' | 'java';
  /** null means "use the reference solution". */
  code: string | null;
  /** As the code runner reports it: ERROR only when compilation fails. */
  status: 'ACCEPTED' | 'FAILED' | 'ERROR';
  /** FAILED only: stdout (or stderr on a crash) for each test case, in order. */
  actual?: string[];
  /** ERROR only: the compile failure; no test case runs. */
  error?: string;
  hoursAgo: number;
}

export const CODE_SUBMISSIONS: SeedCodeSubmission[] = [
  { problem: 'two-sum', by: 'student', language: 'python', code: null, status: 'ACCEPTED', hoursAgo: 190 },
  { problem: 'valid-parentheses', by: 'student', language: 'python', code: null, status: 'ACCEPTED', hoursAgo: 120 },
  { problem: 'coin-change', by: 'student', language: 'python', code: COIN_CHANGE_GREEDY, status: 'FAILED', actual: ['3', '3', '-1', '0'], hoursAgo: 30 },
  { problem: 'coin-change', by: 'student', language: 'python', code: null, status: 'ACCEPTED', hoursAgo: 29 },
  { problem: 'two-sum', by: 'diya_sharma', language: 'javascript', code: TWO_SUM_JS, status: 'ACCEPTED', hoursAgo: 150 },
  { problem: 'valid-parentheses', by: 'kabir_singh', language: 'python', code: PARENS_COUNT_ONLY, status: 'FAILED', actual: ['true', 'true', 'true', 'false'], hoursAgo: 96 },
  { problem: 'binary-search', by: 'aditya_verma', language: 'python', code: BINARY_SEARCH_LINEAR, status: 'ACCEPTED', hoursAgo: 80 },
  { problem: 'binary-search', by: 'meghana_rao', language: 'python', code: BINARY_SEARCH_BROKEN, status: 'FAILED', actual: ['4', '-1', '0', 'IndexError: list index out of range'], hoursAgo: 52 },
  { problem: 'binary-search', by: 'meghana_rao', language: 'python', code: null, status: 'ACCEPTED', hoursAgo: 51 },
  { problem: 'coin-change', by: 'ishita_banerjee', language: 'python', code: null, status: 'ACCEPTED', hoursAgo: 20 },
  { problem: 'two-sum', by: 'karthik_subramanian', language: 'java', code: TWO_SUM_JAVA_BROKEN, status: 'ERROR', error: 'Command failed: javac solution.java. solution.java:9: error: \';\' expected', hoursAgo: 12 },
];

/* ---------------------------------------------------------- notifications */

export interface SeedNotification {
  type:
    | 'TEST_ASSIGNED' | 'TEST_REMINDER' | 'ASSIGNMENT_ASSIGNED' | 'ASSIGNMENT_DEADLINE' | 'RESULT_PUBLISHED'
    | 'TEACHER_FEEDBACK' | 'SYSTEM' | 'COURSE_ANNOUNCEMENT' | 'EXAM_GRADED' | 'CERTIFICATE_ISSUED';
  title: string;
  message: string;
  daysAgo: number;
  isRead: boolean;
}

const assigned = (title: string) => `You have been assigned a new test "${title}". Check your test dashboard.`;

/** Eight notifications for each of the five demo accounts, keyed by username. */
export const NOTIFICATIONS: Record<string, SeedNotification[]> = {
  student: [
    { type: 'TEST_REMINDER', title: `Reminder: ${testTitle.quiz2('CS302')} opens in 3 days`, message: 'Quiz 2 covers memory management: allocation, paging and page replacement. One attempt, open for 24 hours.', daysAgo: 0.2, isRead: false },
    { type: 'TEST_ASSIGNED', title: `New test assigned: ${testTitle.practice('CS302')}`, message: assigned(testTitle.practice('CS302')), daysAgo: 2, isRead: false },
    { type: 'ASSIGNMENT_DEADLINE', title: 'Assignment due in 6 days', message: `"${ASSIGNMENTS.CS302[1].title}" is due in 6 days. You have not submitted yet.`, daysAgo: 1, isRead: false },
    { type: 'COURSE_ANNOUNCEMENT', title: 'CS302: Revision session on deadlocks', message: 'Friday 4 pm, Lab 2. Bring the Module 2 worked examples.', daysAgo: 5, isRead: false },
    { type: 'RESULT_PUBLISHED', title: `Result published: ${testTitle.midterm('CS302')}`, message: 'Your midterm result is available. Review your answers on deadlocks and memory management.', daysAgo: 6, isRead: true },
    { type: 'CERTIFICATE_ISSUED', title: 'Certificate issued: Data Structures and Algorithms', message: 'You have been awarded a midterm merit certificate. View it under Certificates.', daysAgo: 6, isRead: true },
    { type: 'TEACHER_FEEDBACK', title: 'Feedback on your assignment', message: `Dr. Ananya Krishnan graded "${ASSIGNMENTS.CS301[0].title}". Open the assignment to read the feedback.`, daysAgo: 8, isRead: true },
    { type: 'SYSTEM', title: 'Welcome to Meridian Institute of Technology', message: 'Your account is ready. You are enrolled in four courses for Semester 7.', daysAgo: 100, isRead: true },
  ],
  teacher: [
    { type: 'SYSTEM', title: 'Descriptive answers awaiting grading', message: `Some descriptive answers in the ${testTitle.midterm('CS302')} have not been graded yet.`, daysAgo: 0.5, isRead: false },
    { type: 'ASSIGNMENT_ASSIGNED', title: 'New submissions received', message: `Students have started submitting "${ASSIGNMENTS.CS301[1].title}".`, daysAgo: 1, isRead: false },
    { type: 'TEST_REMINDER', title: `${testTitle.quiz2('CS301')} opens in 3 days`, message: 'The quiz is published and assigned to both class sections.', daysAgo: 1, isRead: false },
    { type: 'SYSTEM', title: 'Proctoring review requested', message: `The Examination Cell flagged sessions with a high suspicion score in the ${testTitle.midterm('CS302')}.`, daysAgo: 6, isRead: false },
    { type: 'EXAM_GRADED', title: `${testTitle.midterm('CS301')} graded`, message: 'Objective questions were graded automatically and results are visible to students.', daysAgo: 7, isRead: true },
    { type: 'SYSTEM', title: 'Question analytics updated', message: 'Accuracy and discrimination figures now include the midterm attempts.', daysAgo: 7, isRead: true },
    { type: 'ASSIGNMENT_DEADLINE', title: 'Assignment deadline passed', message: `"${ASSIGNMENTS.CS302[0].title}" is closed. Ungraded submissions are waiting.`, daysAgo: 10, isRead: true },
    { type: 'SYSTEM', title: 'Welcome back for Semester 7', message: 'You are the instructor for CS301 and CS302 this semester.', daysAgo: 100, isRead: true },
  ],
  admin: [
    { type: 'SYSTEM', title: 'Account locked after failed sign-ins', message: 'A student account was locked after five failed sign-in attempts. See the audit log.', daysAgo: 0.6, isRead: false },
    { type: 'SYSTEM', title: 'Drive deadline passed: Quillon Consulting', message: 'Applications closed two days ago; the drive is still marked active.', daysAgo: 2, isRead: false },
    { type: 'SYSTEM', title: 'Leaderboards recalculated', message: 'Course leaderboards were rebuilt after the midterm results.', daysAgo: 6, isRead: false },
    { type: 'CERTIFICATE_ISSUED', title: 'Midterm merit certificates issued', message: 'Certificates were issued to the top three midterm scorers of each course.', daysAgo: 6, isRead: true },
    { type: 'SYSTEM', title: 'Placement drive published: Northwind Systems', message: 'Software Engineer (New Grad), 18.5 LPA. Applications close in 14 days.', daysAgo: 9, isRead: true },
    { type: 'SYSTEM', title: 'Role changed: Imran Qureshi', message: 'The account was moved from TEACHER to PROCTOR.', daysAgo: 60, isRead: true },
    { type: 'SYSTEM', title: 'Student accounts imported', message: '36 student accounts were created for the 2023-27 batches.', daysAgo: 104, isRead: true },
    { type: 'SYSTEM', title: 'Academic year 2026-27 activated', message: 'Semester 7 and Semester 8 are configured for all three departments.', daysAgo: 118, isRead: true },
  ],
  orgadmin: [
    { type: 'SYSTEM', title: 'Re-evaluation requests pending', message: 'Students have requested re-evaluation of descriptive midterm answers. The window closes 7 days after results.', daysAgo: 1, isRead: false },
    { type: 'SYSTEM', title: 'Attendance shortfall report', message: 'Students below the 75 percent attendance threshold are listed for the Semester 7 review.', daysAgo: 3, isRead: false },
    { type: 'RESULT_PUBLISHED', title: 'Midterm results summary ready', message: 'Pass percentages for all four courses are available in Analytics.', daysAgo: 6, isRead: false },
    { type: 'SYSTEM', title: 'Malpractice cases for review', message: 'Proctored midterm sessions with a suspicion score of 50 or more are awaiting a decision.', daysAgo: 6, isRead: true },
    { type: 'SYSTEM', title: 'Placement season update', message: 'Eight drives are listed for the 2027 batch; one is completed with offers released.', daysAgo: 9, isRead: true },
    { type: 'SYSTEM', title: 'Examination Regulations 2026-27 published', message: 'The regulations and the grading policy are available to all students and staff.', daysAgo: 110, isRead: true },
    { type: 'SYSTEM', title: 'Batches created', message: 'CSE, IT and ECE batches for 2023-27 are attached to Semester 7.', daysAgo: 116, isRead: true },
    { type: 'SYSTEM', title: 'Welcome to Meridian Institute of Technology', message: 'You are the organisation administrator for the institute.', daysAgo: 120, isRead: true },
  ],
  proctor: [
    { type: 'TEST_REMINDER', title: 'Upcoming duty: Quiz 2 in all four courses', message: 'The quizzes open in 3 days. They are not proctored live; review flags afterwards.', daysAgo: 0.4, isRead: false },
    { type: 'SYSTEM', title: 'Session review pending', message: 'Flagged midterm sessions need your notes before the Examination Cell meets.', daysAgo: 4, isRead: false },
    { type: 'SYSTEM', title: 'High suspicion score flagged', message: `Repeated paste events and tab switches were recorded in the ${testTitle.midterm('CS302')}.`, daysAgo: 8, isRead: false },
    { type: 'SYSTEM', title: `Proctoring duty: ${testTitle.midterm('CS301')}`, message: 'You were assigned as proctor. All sessions have ended.', daysAgo: 7, isRead: true },
    { type: 'SYSTEM', title: `Proctoring duty: ${testTitle.midterm('CS302')}`, message: 'You were assigned as proctor. All sessions have ended.', daysAgo: 8, isRead: true },
    { type: 'SYSTEM', title: `Proctoring duty: ${testTitle.midterm('CS303')}`, message: 'You were assigned as proctor. All sessions have ended.', daysAgo: 9, isRead: true },
    { type: 'SYSTEM', title: `Proctoring duty: ${testTitle.midterm('CS201')}`, message: 'You were assigned as proctor. All sessions have ended.', daysAgo: 10, isRead: true },
    { type: 'SYSTEM', title: 'Welcome to the Examination Cell', message: 'Your proctor account is active. Live sessions appear on the proctoring dashboard.', daysAgo: 60, isRead: true },
  ],
};
