import { fill, multi, single, subj, tf, type SeedQuestion } from './types.js';

// Order matters inside a lesson: the midterm takes the first two questions of
// every lesson, quizzes take the auto-graded ones in order.
const PROC = 'Processes and Threads';
const SCHED = 'CPU Scheduling';
const SYNC = 'Process Synchronisation';
const DL = 'Deadlock Conditions';
const BANKER = 'Banker\'s Algorithm';
const DETECT = 'Deadlock Detection and Recovery';
const ALLOC = 'Memory Allocation and Fragmentation';
const PAGING = 'Paging and TLB';
const VM = 'Virtual Memory and Page Replacement';

export const OS_QUESTIONS: SeedQuestion[] = [
  // --- Processes and Threads
  single(PROC, 'EASY', 'REMEMBER', 'Which of the following is NOT shared between the threads of one process?',
    ['Heap memory', 'Global variables', 'Open files', 'Stack'],
    3, 'Threads share code, data, heap and open files, but each thread has its own stack, program counter and registers.', ['threads']),
  tf(PROC, 'EASY', 'UNDERSTAND', 'A process can move directly from the waiting (blocked) state to the running state.',
    false, 'When its event occurs a waiting process becomes ready; it runs only after the scheduler dispatches it.', ['process-states']),
  single(PROC, 'MEDIUM', 'APPLY', 'A program calls fork() three times in a row and then prints "hello" once. How many times is "hello" printed in total?',
    ['8', '3', '6', '4'],
    0, 'Each fork() doubles the number of processes: 2^3 = 8 processes, and each prints once.', ['fork']),

  // --- CPU Scheduling
  single(SCHED, 'EASY', 'REMEMBER', 'Which scheduling algorithm suffers from the convoy effect?',
    ['Round Robin', 'First-Come, First-Served', 'Shortest Remaining Time First', 'Multilevel feedback queue'],
    1, 'Under FCFS, short processes queue behind one long CPU-bound process, like cars behind a slow truck.', ['scheduling', 'fcfs']),
  single(SCHED, 'EXPERT', 'APPLY', 'Four processes have (arrival time, burst time): P1 (0, 7), P2 (2, 4), P3 (4, 1), P4 (5, 4). What is the average waiting time under Shortest Remaining Time First?',
    ['4.75', '4.0', '3.0', '2.5'],
    2, 'The Gantt chart is P1 0-2, P2 2-4, P3 4-5, P2 5-7, P4 7-11, P1 11-16. Waiting times are 9, 1, 0 and 2, an average of 12 / 4 = 3.0.', ['scheduling', 'srtf']),
  single(SCHED, 'MEDIUM', 'APPLY', 'Five processes are in the ready queue under Round Robin with a time quantum of 20 ms. What is the longest time a process can wait before it gets its next quantum?',
    ['20 ms', '100 ms', '80 ms', '120 ms'],
    2, 'With n processes and quantum q, a process waits at most (n - 1) x q = 4 x 20 = 80 ms.', ['scheduling', 'round-robin']),

  // --- Process Synchronisation
  single(SYNC, 'EASY', 'APPLY', 'A counting semaphore is initialised to 10. Then 6 wait (P) operations and 4 signal (V) operations complete. What is its value?',
    ['0', '4', '12', '8'],
    3, 'Each wait decrements and each signal increments: 10 - 6 + 4 = 8.', ['semaphores']),
  multi(SYNC, 'MEDIUM', 'REMEMBER', 'Which of the following are requirements of a correct solution to the critical-section problem? Select all that apply.',
    ['Mutual exclusion', 'Progress', 'Bounded waiting', 'Priority inheritance'],
    [0, 1, 2], 'A solution must provide mutual exclusion, progress and bounded waiting. Priority inheritance is a remedy for priority inversion, not a requirement.', ['critical-section']),
  single(SYNC, 'HARD', 'ANALYZE', 'In the bounded-buffer problem, the producer executes wait(mutex) before wait(empty). What happens when the buffer is full?',
    ['The producer overwrites the oldest item', 'Mutual exclusion is violated', 'Nothing; the order of the two waits does not matter', 'Deadlock: the producer sleeps while holding mutex, so the consumer can never enter'],
    3, 'The producer blocks on empty while holding mutex. The consumer needs mutex to remove an item, so neither can proceed.', ['semaphores', 'producer-consumer']),

  // --- Deadlock Conditions
  single(DL, 'EASY', 'REMEMBER', 'Which of the following is NOT one of the four necessary conditions for deadlock?',
    ['Mutual exclusion', 'Hold and wait', 'Preemption of resources', 'Circular wait'],
    2, 'The four conditions are mutual exclusion, hold and wait, no preemption and circular wait. Allowing preemption actually prevents deadlock.', ['deadlock', 'coffman-conditions']),
  subj(DL, 'MEDIUM', 'UNDERSTAND', 'State the four necessary conditions for deadlock and explain one practical technique that prevents deadlock by making one of them impossible.',
    'Model answer. Conditions: mutual exclusion, hold and wait, no preemption, circular wait; all four must hold simultaneously. One technique: impose a total order on resource types and require every process to request resources in increasing order, which makes circular wait impossible (alternatively: request all resources at once to break hold and wait). Award 3 marks for the four conditions with meanings and 2 for a correct technique tied to the condition it breaks.',
    {
      good: 'Deadlock needs four conditions at the same time: (1) mutual exclusion, a resource can be used by only one process; (2) hold and wait, a process holds a resource while waiting for another; (3) no preemption, resources cannot be taken away; (4) circular wait, a cycle of processes each waiting for the next. A practical prevention technique is resource ordering: give every lock a number and always acquire locks in increasing order. Then a process holding a higher-numbered lock never waits for a lower one, so a cycle cannot form and circular wait is impossible.',
      partial: 'The four conditions are mutual exclusion, hold and wait, no preemption and circular wait. Deadlock can be prevented by using the Banker\'s algorithm to check whether the state is safe before granting a request.',
      weak: 'Deadlock happens when two processes wait for each other. The conditions are mutual exclusion and waiting. It can be prevented by restarting the system or killing a process.',
    }, ['deadlock', 'prevention']),
  single(DL, 'MEDIUM', 'APPLY', 'Three processes share identical instances of one resource type, and each process needs at most 2 instances. What is the minimum number of instances that guarantees deadlock cannot occur?',
    ['3', '4', '5', '6'],
    1, 'Deadlock is impossible when R >= n(k - 1) + 1 = 3 x 1 + 1 = 4: even if each process holds one instance, one more lets a process finish.', ['deadlock', 'resources']),
  tf(DL, 'MEDIUM', 'UNDERSTAND', 'A cycle in a resource-allocation graph always means the system is deadlocked, even when resource types have several instances.',
    false, 'With multiple instances a cycle is necessary but not sufficient; a process outside the cycle may release an instance and break it.', ['deadlock', 'resource-allocation-graph']),

  // --- Banker's Algorithm
  single(BANKER, 'EASY', 'REMEMBER', 'In the Banker\'s algorithm, the Need matrix is computed as:',
    ['Max + Allocation', 'Available - Allocation', 'Max - Allocation', 'Allocation - Available'],
    2, 'Need is what a process may still request: its declared maximum minus what it already holds.', ['deadlock', 'bankers-algorithm']),
  single(BANKER, 'HARD', 'APPLY', 'A system has Available = (3, 3, 2). The Need vectors are P0 (7, 4, 3), P1 (1, 2, 2), P2 (6, 0, 0), P3 (0, 1, 1) and P4 (4, 3, 1). Which processes could be first in a safe sequence?',
    ['P0 only', 'P2 or P4', 'P1 or P3', 'Any of the five'],
    2, 'Only Need(P1) = (1,2,2) and Need(P3) = (0,1,1) are less than or equal to Available in every component.', ['deadlock', 'bankers-algorithm', 'safe-state']),
  single(BANKER, 'EXPERT', 'EVALUATE', 'A system uses the Banker\'s algorithm. Available = (2, 3, 0). Allocation: P0 (0,1,0), P1 (3,0,2), P2 (3,0,2), P3 (2,1,1), P4 (0,0,2). Need: P0 (7,4,3), P1 (0,2,0), P2 (6,0,0), P3 (0,1,1), P4 (4,3,1). P0 now requests (0, 2, 0). What does the algorithm do?',
    ['Grants it, because the request does not exceed Available', 'Denies it, because the request exceeds the Need of P0', 'Grants it, because a safe sequence starting with P1 exists', 'Denies it, because the resulting state would be unsafe'],
    3, 'After a trial allocation Available = (2, 1, 0). No process has a Need that fits (P1 needs B = 2, P3 needs C = 1), so no safe sequence exists and P0 must wait.', ['deadlock', 'bankers-algorithm']),

  // --- Deadlock Detection and Recovery
  single(DETECT, 'MEDIUM', 'UNDERSTAND', 'A wait-for graph is obtained from a resource-allocation graph by:',
    ['removing the resource nodes and collapsing the edges through them', 'removing every process that holds no resource', 'reversing the direction of every edge', 'adding an edge for every possible future request'],
    0, 'An edge Pi -> Pj in the wait-for graph means Pi waits for a resource held by Pj; the resource nodes disappear.', ['deadlock', 'wait-for-graph']),
  single(DETECT, 'MEDIUM', 'APPLY', 'With single-instance resources, a wait-for graph has the edges P1 -> P2, P2 -> P3, P3 -> P1 and P4 -> P2. Which statement is correct?',
    ['There is no deadlock because P4 is outside the cycle', 'Only P4 is deadlocked', 'P1, P2 and P3 form a deadlock cycle, and P4 is blocked indefinitely as well', 'A deadlock exists only if the edge P4 -> P1 is added'],
    2, 'The cycle P1 -> P2 -> P3 -> P1 is a deadlock. P4 waits for P2, which will never release its resource, so P4 cannot proceed either.', ['deadlock', 'wait-for-graph']),
  multi(DETECT, 'HARD', 'EVALUATE', 'Which factors are reasonable when choosing a victim process during deadlock recovery? Select all that apply.',
    ['The priority of the process', 'How long it has run and how much work would be lost', 'How many times it has already been rolled back', 'The alphabetical order of its name'],
    [0, 1, 2], 'Victim selection minimises cost: priority, work done, resources held and remaining. Counting earlier rollbacks prevents the same process from starving.', ['deadlock', 'recovery']),

  // --- Memory Allocation and Fragmentation
  single(ALLOC, 'EASY', 'REMEMBER', 'Free memory is split into small scattered holes, so a request fails although the total free memory is sufficient. What is this called?',
    ['Internal fragmentation', 'External fragmentation', 'Thrashing', 'Compaction'],
    1, 'External fragmentation is wasted space between allocated blocks. Internal fragmentation is unused space inside an allocated block.', ['memory', 'fragmentation']),
  single(ALLOC, 'MEDIUM', 'APPLY', 'The free holes, in memory order, are 100 KB, 500 KB, 200 KB, 300 KB and 600 KB. Using best fit, which hole receives a request for 212 KB?',
    ['500 KB', '200 KB', '600 KB', '300 KB'],
    3, 'Best fit chooses the smallest hole that is large enough: 300 KB, leaving 88 KB.', ['memory', 'best-fit']),
  fill(ALLOC, 'MEDIUM', 'APPLY', 'A segment has base 4300 and limit 400. The logical address with offset 53 in that segment maps to the physical address ______.',
    ['4353'], ['4753', '453', '4300'],
    'The offset 53 is below the limit 400, so the physical address is base + offset = 4300 + 53 = 4353.', ['memory', 'segmentation']),

  // --- Paging and TLB
  single(PAGING, 'MEDIUM', 'APPLY', 'The page size is 1 KB (1024 bytes). What are the page number and offset of the logical address 3085?',
    ['Page 3, offset 13', 'Page 2, offset 1037', 'Page 3, offset 85', 'Page 30, offset 85'],
    0, 'floor(3085 / 1024) = 3 and 3085 - 3 x 1024 = 13.', ['paging', 'address-translation']),
  single(PAGING, 'HARD', 'APPLY', 'A TLB lookup takes 10 ns, a memory access takes 100 ns and the TLB hit ratio is 90 percent. What is the effective access time?',
    ['110 ns', '130 ns', '200 ns', '120 ns'],
    3, 'EAT = 0.9 x (10 + 100) + 0.1 x (10 + 100 + 100) = 99 + 21 = 120 ns.', ['paging', 'tlb']),
  tf(PAGING, 'MEDIUM', 'UNDERSTAND', 'Paging eliminates external fragmentation but can still cause internal fragmentation.',
    true, 'Any free frame can hold any page, so there are no unusable holes; the last page of a process is usually partly empty.', ['paging', 'fragmentation']),

  // --- Virtual Memory and Page Replacement
  single(VM, 'EASY', 'REMEMBER', 'Belady\'s anomaly, in which adding frames increases the number of page faults, can occur with which algorithm?',
    ['LRU', 'Optimal', 'FIFO', 'Both LRU and Optimal'],
    2, 'FIFO is not a stack algorithm. LRU and Optimal are, so more frames can never produce more faults for them.', ['virtual-memory', 'page-replacement']),
  fill(VM, 'HARD', 'APPLY', 'For the reference string 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5 with 3 frames, FIFO page replacement causes ______ page faults.',
    ['9', 'nine'], ['10', '7', '8'],
    'The faults occur on references 1, 2, 3, 4, 1, 2, 5, 3 and 4. The second 1 and 2 and the final 5 are hits, giving 9 faults.', ['virtual-memory', 'page-replacement', 'fifo']),
  subj(VM, 'HARD', 'ANALYZE', 'Explain what thrashing is, why it makes CPU utilisation fall, and describe two techniques an operating system can use to control it.',
    'Model answer. Thrashing: processes have too few frames, so they page-fault continuously and spend more time waiting for the paging disk than executing; CPU utilisation falls, and a scheduler that reacts by admitting more processes makes it worse. Controls: the working-set model (allocate each process enough frames for the pages referenced in its recent window; suspend a process if the total demand exceeds memory) and page-fault-frequency control (give frames to a process whose fault rate is above an upper bound and take frames from one below a lower bound). Award 2 marks for the explanation, 1 for the utilisation argument and 1 for each technique.',
    {
      good: 'Thrashing occurs when processes do not have enough frames for the pages they are actively using. Each one faults almost continuously, so processes sit in the paging queue and the CPU is idle. The OS sees low CPU utilisation and may raise the degree of multiprogramming, which removes even more frames and makes it worse. Two controls: (1) the working-set model, which tracks the pages each process used in the last delta references and gives it that many frames, suspending a process if the total exceeds available memory; (2) page-fault frequency, which adds frames to a process whose fault rate is too high and removes frames when the rate is very low.',
      partial: 'Thrashing is when the system spends most of its time swapping pages in and out instead of running processes, so CPU utilisation drops. It can be controlled by adding more RAM or by using the working-set model.',
      weak: 'Thrashing means the hard disk is working a lot. It happens when there are too many page tables. It can be controlled by using a faster disk.',
    }, ['virtual-memory', 'thrashing']),
];
