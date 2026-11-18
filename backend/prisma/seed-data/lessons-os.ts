import type { SeedModule } from './types.js';

export const OS_MODULES: SeedModule[] = [
  {
    title: 'Processes and Scheduling',
    description: 'What a process is, how the CPU is shared between processes, and how they coordinate access to shared data.',
    lessons: [
      {
        title: 'Processes, Threads and Context Switching',
        topic: 'Processes and Threads',
        durationMin: 35,
        content: `# Processes, Threads and Context Switching

A **program** is a passive file on disk; a **process** is a program in execution. The operating system gives each process its own address space (code, data, heap and stack) and tracks it with a **Process Control Block (PCB)**.

## What the PCB stores

- Process identifier (PID) and process state
- Program counter and CPU registers
- CPU-scheduling information (priority, queue pointers)
- Memory-management information (page table base, limits)
- Accounting information and the list of open files

## Process states

| State | Meaning |
|---|---|
| New | The process is being created |
| Ready | Waiting in the ready queue for the CPU |
| Running | Instructions are being executed |
| Waiting (blocked) | Waiting for I/O or an event |
| Terminated | Finished execution |

Typical transitions: Ready -> Running (dispatch), Running -> Ready (time slice expires or a higher-priority process arrives), Running -> Waiting (I/O request), Waiting -> Ready (I/O completes). A process never moves directly from Waiting to Running.

## Context switch

When the CPU moves from one process to another, the kernel saves the state of the old process in its PCB and loads the saved state of the new one. A context switch is pure overhead: no user work is done, and the caches and the TLB lose their useful contents.

## Threads

A **thread** is a unit of execution inside a process. Threads of the same process share the code, global data, heap and open files, but each thread has its own **stack, program counter and register set**.

| Aspect | Process | Thread |
|---|---|---|
| Address space | Separate | Shared with sibling threads |
| Creation and switch cost | High | Low |
| Communication | Needs IPC (pipes, sockets, shared memory) | Direct, through shared variables |
| Fault isolation | A crash affects one process | A crash can kill the whole process |

**User-level threads** are managed by a library; the kernel sees one process, so one blocking system call blocks all of them. **Kernel-level threads** are scheduled by the kernel and can run on different cores.

## Worked example: counting processes after fork

\`\`\`c
int main(void) {
    fork();
    fork();
    printf("hello\\n");
    return 0;
}
\`\`\`

Each fork() duplicates the calling process. After the first call there are 2 processes; both execute the second call, giving 4. The word hello is printed **4 times**. In general, n consecutive fork() calls produce 2 to the power n processes, of which 2 to the power n minus 1 are children. fork() returns 0 in the child and the child's PID in the parent.

## Common mistakes

- Saying threads share the stack. Each thread has its own stack; local variables are private.
- Counting the original process as a child. After 3 fork() calls there are 8 processes but only 7 children.
- Confusing the ready and waiting states: a ready process needs only the CPU, a waiting process needs an event first.
- Assuming a context switch between two threads of one process is free. It is cheaper than a process switch, because the address space stays the same, but registers and the stack pointer are still saved and restored.`,
      },
      {
        title: 'CPU Scheduling Algorithms',
        topic: 'CPU Scheduling',
        durationMin: 50,
        content: `# CPU Scheduling Algorithms

The short-term scheduler picks which ready process gets the CPU next. Its choice determines how responsive and how efficient the system feels.

## Criteria

- **Turnaround time** = completion time - arrival time
- **Waiting time** = turnaround time - burst time
- **Response time** = time of first CPU allocation - arrival time
- **Throughput** = processes completed per unit time

## Algorithms

| Algorithm | Rule | Preemptive | Main weakness |
|---|---|---|---|
| FCFS | Run in arrival order | No | Convoy effect: short jobs wait behind a long one |
| SJF | Shortest burst first | No | Long jobs may starve; burst length must be predicted |
| SRTF | Shortest remaining time first | Yes | Starvation; more context switches |
| Round Robin | Each process gets a time quantum in turn | Yes | Performance depends on the quantum |
| Priority | Highest priority first | Either | Starvation, solved by **aging** |

SJF gives the minimum average waiting time among non-preemptive algorithms, and SRTF gives the minimum overall.

## Worked example

| Process | Arrival | Burst |
|---|---|---|
| P1 | 0 | 7 |
| P2 | 2 | 4 |
| P3 | 4 | 1 |
| P4 | 5 | 4 |

**FCFS** Gantt chart:

\`\`\`text
| P1      | P2    | P3 | P4    |
0         7       11   12      16
\`\`\`

Waiting times: P1 = 0, P2 = 7 - 2 = 5, P3 = 11 - 4 = 7, P4 = 12 - 5 = 7. Average = 19 / 4 = **4.75**.

**SRTF** Gantt chart:

\`\`\`text
| P1 | P2 | P3 | P2 | P4    | P1      |
0    2    4    5    7       11        16
\`\`\`

- At time 2, P2 (burst 4) is shorter than P1's remaining 5, so P2 preempts.
- At time 4, P3 (burst 1) is shorter than P2's remaining 2, so P3 runs.
- At time 5, the remaining times are P1 = 5, P2 = 2, P4 = 4, so P2 finishes first, then P4, then P1.

Completion times: P1 = 16, P2 = 7, P3 = 5, P4 = 11. Turnaround: 16, 5, 1, 6. Waiting = turnaround - burst: 9, 1, 0, 2. Average = 12 / 4 = **3.0**.

Non-preemptive **SJF** on the same data runs P1, P3, P2, P4 and gives waiting times 0, 6, 3, 7, an average of **4.0**.

## Round Robin and the quantum

- A very large quantum makes Round Robin behave like FCFS.
- A very small quantum wastes time on context switches.
- A common guideline is that about 80 percent of CPU bursts should be shorter than the quantum.
- With n ready processes and quantum q, no process waits more than (n - 1) x q before its next turn.

## Exam tips

- Always draw the Gantt chart first, then read completion times off it.
- In SRTF, re-evaluate only when a process arrives or finishes.
- Break ties by arrival order (FCFS) unless the question says otherwise.
- Waiting time excludes the time the process itself spends on the CPU; do not forget to subtract the burst.
- Multilevel feedback queues move a process that uses its full quantum to a lower-priority queue, which favours interactive, I/O-bound work.`,
      },
      {
        title: 'Process Synchronisation and Semaphores',
        topic: 'Process Synchronisation',
        durationMin: 45,
        content: `# Process Synchronisation and Semaphores

When several threads update shared data, the result can depend on the exact order in which their instructions interleave. This is a **race condition**.

## The problem

The statement counter = counter + 1 is really three machine steps: load counter into a register, add 1, store the register back. If two threads each run it 1000 times without protection, some updates are lost and the final value can be anything from 2 up to 2000.

The code that touches shared data is the **critical section**. A correct solution must provide:

1. **Mutual exclusion**: at most one process is inside the critical section at a time.
2. **Progress**: if no one is inside, a process that wants to enter is not postponed forever by processes that are not interested.
3. **Bounded waiting**: there is a limit on how many times others can enter before a waiting process gets its turn.

## Semaphores

A semaphore S is an integer accessed only through two atomic operations:

\`\`\`text
wait(S):   while S <= 0, block;  S = S - 1      (also written P or down)
signal(S): S = S + 1; wake one waiting process  (also written V or up)
\`\`\`

- A **binary semaphore** (values 0 and 1) provides mutual exclusion, like a mutex lock.
- A **counting semaphore** controls access to a resource with several identical instances.

### Worked example: semaphore arithmetic

A counting semaphore starts at 10. After 6 wait operations and 4 signal operations its value is 10 - 6 + 4 = **8**.

In the implementation where the value may become negative, a semaphore initialised to 3 on which 5 processes call wait ends at -2: the magnitude tells us **2 processes are blocked**.

## Producer-consumer with a bounded buffer

Use three semaphores: mutex = 1, empty = N (free slots) and full = 0 (filled slots).

\`\`\`text
Producer:                 Consumer:
  wait(empty)               wait(full)
  wait(mutex)               wait(mutex)
  add item to buffer        remove item from buffer
  signal(mutex)             signal(mutex)
  signal(full)              signal(empty)
\`\`\`

The order of the two wait calls matters. If the producer took mutex first and then found the buffer full, it would sleep while holding mutex, the consumer could never enter, and the system would **deadlock**.

## Other tools

- **Mutex lock**: acquire and release; only the owner may release it.
- **Spinlock**: busy-waits instead of sleeping. Useful on multiprocessors when the critical section is very short, wasteful on a single CPU.
- **Test-and-set** and **compare-and-swap**: atomic hardware instructions used to build locks.
- **Monitor**: a language construct that allows only one active thread inside, with condition variables for waiting.

## Common mistakes

- Swapping wait and signal, or forgetting signal on an error path, which blocks everyone else forever.
- Treating a mutex and a binary semaphore as identical. A semaphore has no owner, so any thread can signal it.
- Believing disabling interrupts is a general solution. It does not work on multiprocessors and is unsafe in user code.
- Assuming busy waiting satisfies bounded waiting. A simple test-and-set lock gives mutual exclusion but no bound on waiting.`,
      },
    ],
  },
  {
    title: 'Deadlocks',
    description: 'When deadlock can occur, how to avoid it with the Banker\'s algorithm, and how to detect and recover from it.',
    lessons: [
      {
        title: 'Deadlock Conditions and Prevention',
        topic: 'Deadlock Conditions',
        durationMin: 40,
        content: `# Deadlock Conditions and Prevention

A set of processes is **deadlocked** when every process in the set is waiting for a resource held by another process in the same set. None of them can ever proceed without outside intervention.

## The four necessary conditions

Deadlock can arise only if all four conditions (the Coffman conditions) hold **at the same time**:

1. **Mutual exclusion**: at least one resource is non-sharable; only one process can use it at a time.
2. **Hold and wait**: a process holds at least one resource while waiting for others.
3. **No preemption**: a resource cannot be taken away; it is released only voluntarily.
4. **Circular wait**: there is a chain P1 -> P2 -> ... -> Pn -> P1 in which each process waits for a resource held by the next.

They are necessary but not sufficient: all four may hold and the system may still escape deadlock if some process outside the cycle releases an instance.

## Resource-allocation graph (RAG)

- Processes are drawn as circles, resource types as rectangles with one dot per instance.
- A **request edge** goes from a process to a resource; an **assignment edge** goes from a resource instance to a process.

| Graph | Conclusion |
|---|---|
| No cycle | No deadlock |
| Cycle, every resource has a single instance | Deadlock |
| Cycle, some resource has several instances | Deadlock is possible but not certain |

### Worked example

P1 holds R1 and requests R2. P2 holds R2 and requests R1. The graph contains the cycle P1 -> R2 -> P2 -> R1 -> P1, and both resources have one instance, so the two processes are deadlocked.

## Prevention: break one condition

| Condition attacked | Technique | Cost |
|---|---|---|
| Mutual exclusion | Make the resource sharable, for example by spooling a printer | Impossible for most resources |
| Hold and wait | Request everything at once, or release all held resources before asking for more | Low utilisation, possible starvation |
| No preemption | Take resources back from a process that must wait | Only works when state can be saved and restored |
| Circular wait | Number the resource types and require requests in increasing order | Programmers must respect the order |

Resource ordering is the most practical method. If every thread locks mutex A before mutex B, no thread can hold B while waiting for A, so no cycle can form.

## A useful formula

Suppose n processes share R identical instances and each needs at most k instances. Deadlock is impossible when

\`\`\`text
R >= n x (k - 1) + 1
\`\`\`

In the worst case every process holds k - 1 instances; one more instance lets some process finish and release its share. Example: 3 processes each needing 2 instances are deadlock-free with 3 x 1 + 1 = **4** instances. With different maximum needs, use the sum of (max - 1) over all processes, plus 1.

## The four ways to handle deadlock

Prevention, avoidance (Banker's algorithm), detection with recovery, and ignoring the problem. Most general-purpose operating systems choose the last option, known as the **ostrich algorithm**, because deadlocks are rare and prevention is expensive.

## Common mistakes

- Saying any one condition causes deadlock. All four must hold together.
- Treating a cycle in the RAG as proof of deadlock when resources have multiple instances.
- Confusing **starvation** (a process waits indefinitely while others make progress) with deadlock (nobody in the set makes progress).`,
      },
      {
        title: 'Deadlock Avoidance: the Banker\'s Algorithm',
        topic: 'Banker\'s Algorithm',
        durationMin: 50,
        content: `# Deadlock Avoidance: the Banker's Algorithm

Avoidance lets all four deadlock conditions exist but examines every request before granting it. Each process declares in advance the **maximum** number of instances of each resource type it may need. A request is granted only if the system stays in a **safe state**.

## Safe state

A state is safe if there is a **safe sequence**: an order of all processes such that each one can obtain its remaining need from the currently available resources plus those released by the processes before it. A safe state is never a deadlock; an unsafe state is not necessarily a deadlock, but it may lead to one.

## Data structures

For n processes and m resource types:

- **Available[m]**: free instances of each type
- **Max[n][m]**: maximum demand of each process
- **Allocation[n][m]**: instances currently held
- **Need[n][m]** = Max - Allocation

## Safety algorithm

1. Set Work = Available and Finish[i] = false for every process.
2. Find a process i with Finish[i] = false and Need[i] <= Work.
3. If found, set Work = Work + Allocation[i], Finish[i] = true, and repeat step 2.
4. If every Finish[i] is true, the state is safe.

## Worked example

Five processes and three resource types with totals A = 10, B = 5, C = 7.

| Process | Allocation (A B C) | Max (A B C) | Need (A B C) |
|---|---|---|---|
| P0 | 0 1 0 | 7 5 3 | 7 4 3 |
| P1 | 2 0 0 | 3 2 2 | 1 2 2 |
| P2 | 3 0 2 | 9 0 2 | 6 0 0 |
| P3 | 2 1 1 | 2 2 2 | 0 1 1 |
| P4 | 0 0 2 | 4 3 3 | 4 3 1 |

Available = (3, 3, 2).

- P1: Need (1,2,2) <= (3,3,2). Work becomes (5,3,2).
- P3: Need (0,1,1) <= (5,3,2). Work becomes (7,4,3).
- P4: Need (4,3,1) <= (7,4,3). Work becomes (7,4,5).
- P2: Need (6,0,0) <= (7,4,5). Work becomes (10,4,7).
- P0: Need (7,4,3) <= (10,4,7). Work becomes (10,5,7).

The state is **safe** with the sequence P1, P3, P4, P2, P0.

## Resource-request algorithm

When process Pi requests a vector Request:

1. If Request > Need[i], raise an error: the process exceeded its declared maximum.
2. If Request > Available, Pi must wait.
3. Otherwise pretend to allocate: Available -= Request, Allocation[i] += Request, Need[i] -= Request. Run the safety algorithm. If the new state is safe, grant the request; if not, undo the changes and make Pi wait.

**P1 requests (1, 0, 2).** Both checks pass. The trial state has Available = (2,3,0) and Need of P1 = (0,2,0). The sequence P1, P3, P4, P0, P2 is safe, so the request is **granted**.

**P0 then requests (0, 2, 0).** It is within Need and Available, but the trial state leaves Available = (2,1,0), and no process has a Need that fits. The state would be unsafe, so the request is **denied** even though the resources are free.

## Exam tips

- Compute the Need matrix first; most errors come from using Max instead of Need.
- Compare vectors component by component: every component must fit.
- A safe sequence is usually not unique.
- The safety algorithm costs on the order of m x n x n operations.
- Limitations: maximum needs must be known in advance and the number of processes and resources must stay fixed, so the algorithm is rarely used in general-purpose systems.`,
      },
      {
        title: 'Deadlock Detection and Recovery',
        topic: 'Deadlock Detection and Recovery',
        durationMin: 40,
        content: `# Deadlock Detection and Recovery

If a system uses neither prevention nor avoidance, deadlocks may occur. The system then needs an algorithm that examines its state to **detect** a deadlock and a way to **recover** from it.

## Single instance of each resource: wait-for graph

Remove the resource nodes from the resource-allocation graph and collapse the edges: an edge Pi -> Pj means Pi is waiting for a resource held by Pj. A deadlock exists **if and only if** the wait-for graph contains a cycle. Finding a cycle takes on the order of n squared operations for n processes.

### Worked example

Edges: P1 -> P2, P2 -> P3, P3 -> P1 and P4 -> P2. The cycle P1, P2, P3 is deadlocked. P4 is not in the cycle, but it is blocked as well, because the process it waits for will never release its resource.

## Several instances: detection algorithm

The algorithm resembles the Banker's safety check but uses the **current Request** matrix instead of Need. It is optimistic: it assumes a process whose request can be met will finish and return everything it holds.

1. Work = Available. Finish[i] = true if Allocation[i] is zero, otherwise false.
2. Find i with Finish[i] = false and Request[i] <= Work.
3. If found, Work += Allocation[i], Finish[i] = true, and repeat.
4. Every process with Finish[i] = false is deadlocked.

### Worked example

Resource totals A = 7, B = 2, C = 6 and Available = (0, 0, 0).

| Process | Allocation (A B C) | Request (A B C) |
|---|---|---|
| P0 | 0 1 0 | 0 0 0 |
| P1 | 2 0 0 | 2 0 2 |
| P2 | 3 0 3 | 0 0 0 |
| P3 | 2 1 1 | 1 0 0 |
| P4 | 0 0 2 | 0 0 2 |

P0 can finish (Work = 0,1,0), then P2 (3,1,3), then P3 (5,2,4), then P1 (7,2,4), then P4 (7,2,6). Every process finishes, so there is **no deadlock**.

Now let P2 request one more instance of C, so its Request is (0, 0, 1). Only P0 can finish, leaving Work = (0,1,0), which satisfies nobody else. Processes **P1, P2, P3 and P4 are deadlocked**.

## When to run detection

Running it on every request finds deadlock immediately but is expensive. Common choices are to run it periodically, or when CPU utilisation drops below a threshold such as 40 percent, since deadlocked processes do no work.

## Recovery

**Process termination**

- Abort all deadlocked processes: simple, but throws away a lot of work.
- Abort one process at a time until the cycle is broken, rerunning detection after each abort.
- Choose the victim by priority, how long it has run, how many resources it holds and how many it still needs.

**Resource preemption**

- **Select a victim** so that cost is minimal.
- **Roll back** the victim to a safe state and restart it from there.
- **Prevent starvation** by counting rollbacks in the cost, so the same process is not chosen every time.

## Comparison of strategies

| Strategy | Idea | Drawback |
|---|---|---|
| Prevention | Make one condition impossible | Poor resource utilisation |
| Avoidance | Grant only requests that keep the state safe | Needs maximum claims in advance |
| Detection and recovery | Let it happen, then fix it | Lost work, run-time overhead |

## Common mistakes

- Using Need instead of Request in the detection algorithm.
- Declaring a deadlock from a cycle when resources have several instances.
- Forgetting that a process outside the cycle can still be blocked by it.`,
      },
    ],
  },
  {
    title: 'Memory Management',
    description: 'How main memory is allocated, how paging translates addresses, and how virtual memory decides which page to evict.',
    lessons: [
      {
        title: 'Contiguous Allocation and Fragmentation',
        topic: 'Memory Allocation and Fragmentation',
        durationMin: 40,
        content: `# Contiguous Allocation and Fragmentation

A process generates **logical addresses**; the hardware must turn them into **physical addresses** in main memory. In the simplest scheme each process occupies one contiguous block and the Memory Management Unit uses two registers:

- the **base (relocation) register** holds the start of the block, and
- the **limit register** holds its length.

Every logical address is compared with the limit; if it is smaller, the base is added to form the physical address, otherwise the hardware traps to the operating system.

## Fixed and variable partitions

- **Fixed partitioning** divides memory into partitions of preset sizes. A process smaller than its partition wastes the remainder: **internal fragmentation**.
- **Variable partitioning** carves out exactly the requested size. Over time free memory breaks into small scattered holes: **external fragmentation**. A request can fail although the total free memory is sufficient, because no single hole is large enough.

## Placement strategies

| Strategy | Rule |
|---|---|
| First fit | Take the first hole that is large enough |
| Best fit | Take the smallest hole that is large enough |
| Worst fit | Take the largest hole |
| Next fit | Like first fit, but continue from where the last search stopped |

### Worked example

Free holes, in memory order: 100 KB, 500 KB, 200 KB, 300 KB, 600 KB. Requests arrive in the order 212 KB, 417 KB, 112 KB, 426 KB.

**First fit**

- 212 goes into 500, leaving a hole of 288.
- 417 goes into 600, leaving 183.
- 112 goes into the 288 hole, leaving 176.
- 426 cannot be placed: the holes are 100, 176, 200, 300 and 183.

**Best fit**

- 212 goes into 300, leaving 88.
- 417 goes into 500, leaving 83.
- 112 goes into 200, leaving 88.
- 426 goes into 600, leaving 174.

**Worst fit**

- 212 goes into 600, leaving 388.
- 417 goes into 500, leaving 83.
- 112 goes into 388, leaving 276.
- 426 cannot be placed.

Only best fit satisfies all four requests here. In general first fit and best fit use memory about equally well, and first fit is faster because it stops searching earlier.

## Dealing with external fragmentation

- **Compaction** moves all processes to one end to merge the holes. It needs run-time relocation and costs a lot of copying.
- The **50-percent rule**: with first fit, for every N allocated blocks about half as many are lost to fragmentation, so roughly one third of memory may be unusable.
- **Paging** and **segmentation** remove the need for one contiguous block.

## Segmentation in brief

A program is a collection of segments (code, stack, heap). A logical address is the pair (segment number, offset). The segment table stores a base and a limit for each segment.

Example: segment 2 has base 4300 and limit 400. The address (2, 53) maps to 4300 + 53 = **4353**. The address (2, 450) causes a trap because 450 is not less than the limit.

## Common mistakes

- Mixing up the two kinds of fragmentation. Internal is wasted space inside an allocated block; external is wasted space between blocks.
- Saying paging has no fragmentation at all. It has no external fragmentation, but the last page of a process is usually partly empty.
- Assuming best fit is always best. It leaves the smallest, least useful leftover holes and must search the whole list.`,
      },
      {
        title: 'Paging and the TLB',
        topic: 'Paging and TLB',
        durationMin: 45,
        content: `# Paging and the TLB

Paging removes external fragmentation by cutting memory into fixed-size pieces. Physical memory is divided into **frames**, and each process's logical address space is divided into **pages** of the same size. Any page can be placed in any free frame.

## Address translation

A logical address is split into a **page number** and an **offset**. The page number indexes the process's **page table**, which gives a frame number; the offset is copied unchanged.

\`\`\`text
physical address = frame number x page size + offset
\`\`\`

### Worked example 1: translating an address

Page size is 1 KB (1024 bytes). The logical address is 3085.

- Page number = floor(3085 / 1024) = 3
- Offset = 3085 - 3 x 1024 = 13
- If the page table maps page 3 to frame 7, the physical address is 7 x 1024 + 13 = **7181**.

### Worked example 2: size of a page table

A 32-bit logical address with 4 KB pages:

- Offset bits = log2(4096) = 12
- Page-number bits = 32 - 12 = 20, so there are 2 to the power 20 (about one million) pages.
- With 4-byte entries, the page table needs 4 MB **per process**.

That cost is why real systems use **multilevel page tables**, which allocate inner tables only for the regions of the address space actually in use, or **inverted page tables**, which keep one entry per physical frame.

## A page-table entry

Besides the frame number, each entry carries control bits:

| Bit | Purpose |
|---|---|
| Valid / invalid | Is the page legal and in memory? |
| Protection | Read, write and execute permissions |
| Reference | Set when the page is accessed; used by page replacement |
| Dirty (modified) | Set on a write; the page must be saved before its frame is reused |

## Translation look-aside buffer (TLB)

Looking in the page table costs an extra memory access for every reference. The **TLB** is a small, fast associative cache of recent page-to-frame translations.

- **TLB hit**: the frame number comes from the TLB; one memory access is needed.
- **TLB miss**: the page table is consulted (one extra memory access), and the translation is added to the TLB.

### Worked example 3: effective access time

TLB lookup takes 10 ns, a memory access takes 100 ns, and the hit ratio is 90 percent.

\`\`\`text
EAT = 0.90 x (10 + 100) + 0.10 x (10 + 100 + 100)
    = 99 + 21
    = 120 ns
\`\`\`

Without a TLB every reference would cost 200 ns.

On a context switch the TLB entries of the old process are no longer valid. Either the TLB is flushed, or each entry is tagged with an **address-space identifier (ASID)** so entries of several processes can coexist.

## Common mistakes

- Using a page size that is not a power of two. Sizes are powers of two so the split into page number and offset is a simple bit operation.
- Forgetting the TLB lookup time on a miss: the miss path pays for the TLB, the page table and the memory access.
- Saying paging eliminates all fragmentation. It still has internal fragmentation, on average half a page per process.
- Confusing a TLB miss with a page fault. A miss only means the translation is not cached; a page fault means the page is not in memory at all.`,
      },
      {
        title: 'Virtual Memory and Page Replacement',
        topic: 'Virtual Memory and Page Replacement',
        durationMin: 50,
        content: `# Virtual Memory and Page Replacement

Virtual memory lets a process run when only part of it is in main memory. With **demand paging**, a page is loaded only when it is first referenced, so programs can be larger than physical memory and more processes fit at once.

## Handling a page fault

1. The reference finds the valid bit clear and traps to the operating system.
2. The OS checks that the address is legal; if not, the process is terminated.
3. It finds a free frame, or chooses a victim page. A dirty victim is written to disk first.
4. The required page is read from disk into the frame.
5. The page table is updated and the faulting instruction is restarted.

### Worked example: effective access time

Memory access = 200 ns, page-fault service time = 8 ms, and one access in 1000 faults (p = 0.001).

\`\`\`text
EAT = (1 - p) x 200 ns + p x 8,000,000 ns
    = 199.8 + 8000
    = 8199.8 ns
\`\`\`

A fault rate of only 0.1 percent makes memory about 40 times slower, so the fault rate must be kept extremely low.

## Page-replacement algorithms

| Algorithm | Victim | Notes |
|---|---|---|
| FIFO | The page loaded earliest | Simple; suffers from Belady's anomaly |
| Optimal | The page not used for the longest time in the future | Lowest fault count; not implementable, used as a benchmark |
| LRU | The page not used for the longest time in the past | Good approximation of Optimal; costly to implement exactly |
| Clock (second chance) | The first page found with reference bit 0 | Practical approximation of LRU |

### Worked example: FIFO with 3 frames

Reference string: 1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5

| Reference | 1 | 2 | 3 | 4 | 1 | 2 | 5 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Frames after | 1 | 1 2 | 1 2 3 | 2 3 4 | 3 4 1 | 4 1 2 | 1 2 5 | 1 2 5 | 1 2 5 | 2 5 3 | 5 3 4 | 5 3 4 |
| Fault | yes | yes | yes | yes | yes | yes | yes | no | no | yes | yes | no |

FIFO with 3 frames gives **9 faults**. On the same string:

- FIFO with 4 frames gives **10 faults**. More memory produced more faults: this is **Belady's anomaly**.
- LRU with 3 frames gives 10 faults.
- Optimal with 3 frames gives 7 faults.

LRU and Optimal are **stack algorithms**: the pages held with n frames are always a subset of those held with n + 1 frames, so they can never show Belady's anomaly.

## Thrashing

If processes do not have enough frames, they fault constantly, the CPU sits idle waiting for the disk, and the scheduler may respond by admitting even more processes. Throughput collapses: the system is **thrashing**. The remedies rely on **locality of reference**:

- The **working-set model** gives each process the frames for the pages it used in the last delta references.
- **Page-fault frequency** control adds frames to a process that faults too often and removes frames from one that rarely faults.

## Common mistakes

- Counting the first references to empty frames as hits. Every first load is a fault.
- Applying LRU by looking forward in the string; that is Optimal. LRU looks backward.
- Claiming Belady's anomaly applies to LRU. It applies to FIFO and some other non-stack algorithms.
- Forgetting the dirty bit: a clean victim can be discarded, a dirty one must be written back.`,
      },
    ],
  },
];
