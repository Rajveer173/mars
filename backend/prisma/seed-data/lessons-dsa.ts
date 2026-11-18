import type { SeedModule } from './types.js';

export const DSA_MODULES: SeedModule[] = [
  {
    title: 'Analysis, Linear Structures and Hashing',
    description: 'How to measure an algorithm, the stack and queue disciplines, and constant-time lookup with hash tables.',
    lessons: [
      {
        title: 'Complexity Analysis and Big-O',
        topic: 'Complexity Analysis',
        durationMin: 40,
        content: `# Complexity Analysis and Big-O

We compare algorithms by how their running time grows with the input size n, not by seconds on one machine. Asymptotic notation describes that growth while ignoring constant factors and lower-order terms.

## The three notations

- **Big-O**, an upper bound: f(n) is O(g(n)) if f(n) <= c x g(n) for some constant c and all sufficiently large n.
- **Big-Omega**, a lower bound: f(n) >= c x g(n) for all sufficiently large n.
- **Big-Theta**, a tight bound: both O(g(n)) and Omega(g(n)).

For example 3n^2 + 5n + 2 is Theta(n^2). It is also O(n^3), which is true but not tight.

## Growth rates, slowest to fastest

\`\`\`text
1  <  log n  <  sqrt(n)  <  n  <  n log n  <  n^2  <  n^3  <  2^n  <  n!
\`\`\`

## Reading loops

| Code pattern | Time |
|---|---|
| One loop from 1 to n | O(n) |
| Two nested loops, each to n | O(n^2) |
| Loop where i doubles each time (i = i * 2) | O(log n) |
| Outer loop to n, inner loop doubling | O(n log n) |
| Inner loop runs i times for i = 1..n | 1 + 2 + ... + n = n(n + 1) / 2, so O(n^2) |

## Recurrences and the Master theorem

Divide-and-conquer algorithms give recurrences of the form T(n) = a T(n / b) + f(n): a subproblems, each of size n / b, plus f(n) work to split and combine. Compare f(n) with n raised to the power log base b of a.

- If f(n) grows more slowly, the leaves dominate: T(n) = Theta(n^(log_b a)).
- If they grow at the same rate, T(n) = Theta(n^(log_b a) x log n).
- If f(n) grows faster (and is regular), the root dominates: T(n) = Theta(f(n)).

### Worked examples

| Recurrence | a, b | n^(log_b a) | Result | Algorithm |
|---|---|---|---|---|
| T(n) = T(n/2) + 1 | 1, 2 | 1 | Theta(log n) | Binary search |
| T(n) = 2T(n/2) + n | 2, 2 | n | Theta(n log n) | Merge sort |
| T(n) = 4T(n/2) + n | 4, 2 | n^2 | Theta(n^2) | Leaves dominate |
| T(n) = T(n/2) + n | 1, 2 | 1 | Theta(n) | Root dominates |

The recurrence T(n) = T(n - 1) + n is not of this form; expanding it gives n + (n - 1) + ... + 1, which is Theta(n^2). This is the worst case of quicksort.

## Best, worst and average case

Linear search takes 1 comparison in the best case, n in the worst case and about n / 2 on average; the last two are both O(n). Quicksort is O(n log n) on average but O(n^2) in the worst case.

## Amortised analysis

A dynamic array doubles its capacity when full. One append occasionally costs O(n) for copying, but n appends cost O(n) in total, so each append is **O(1) amortised**.

## Space complexity

Count the extra memory used, including the recursion stack. Recursive binary search uses O(log n) stack space; merge sort needs O(n) for its temporary array.

## Common mistakes

- Treating Big-O as "the worst case". Big-O is a bound on a function; it can describe the best, average or worst case.
- Keeping constants: O(2n) is simply O(n).
- Adding when you should multiply. Sequential loops add their costs; nested loops multiply them.
- Assuming a lower complexity always wins. For small n an O(n^2) algorithm with a tiny constant can beat an O(n log n) one, which is why libraries switch to insertion sort for short arrays.`,
      },
      {
        title: 'Stacks and Queues',
        topic: 'Stacks and Queues',
        durationMin: 35,
        content: `# Stacks and Queues

Stacks and queues are restricted lists: they differ only in which element may be removed next.

## Stack: last in, first out (LIFO)

Operations, all O(1): **push** adds to the top, **pop** removes from the top, **peek** reads the top without removing it.

Applications: the function-call stack, undo, backtracking, depth-first search, checking balanced brackets and evaluating expressions.

### Worked example 1: balanced brackets

Scan the string left to right. Push every opening bracket. On a closing bracket, the stack must be non-empty and its top must be the matching opening bracket; pop it. At the end the stack must be empty.

\`\`\`python
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
\`\`\`

For "{[()]}" the stack grows to three symbols and empties again, so the result is True. For "([)]" the closing ) meets [ on top, so the result is False.

### Worked example 2: postfix evaluation

In postfix notation the operator follows its operands, so no brackets are needed. Push operands; on an operator, pop two values, apply it, and push the result. The value popped **second** is the left operand.

Evaluate 5 3 + 8 2 - *

| Token | Action | Stack |
|---|---|---|
| 5 | push | 5 |
| 3 | push | 5 3 |
| + | 5 + 3 | 8 |
| 8 | push | 8 8 |
| 2 | push | 8 8 2 |
| - | 8 - 2 | 8 6 |
| * | 8 x 6 | 48 |

The answer is 48. Conversions to remember: the infix A + B * C is A B C * + in postfix, and (A + B) * C is A B + C *.

## Queue: first in, first out (FIFO)

Operations, all O(1): **enqueue** adds at the rear, **dequeue** removes from the front.

Applications: CPU and printer scheduling, buffering, and breadth-first search.

### Circular queue in an array

A simple array queue wastes the cells freed at the front. A circular queue wraps the indexes around with modular arithmetic:

\`\`\`text
rear  = (rear + 1) mod n      on enqueue
front = (front + 1) mod n     on dequeue
empty when front == rear
full  when (rear + 1) mod n == front
\`\`\`

With these conditions one cell is always left unused, so an array of size n holds at most **n - 1** elements. The sacrifice is what lets us distinguish full from empty.

## Variants

- **Deque**: insertion and removal at both ends.
- **Priority queue**: the element with the highest priority leaves first; usually implemented with a heap.
- **Queue from two stacks**: push onto the first stack; to dequeue, pop from the second, refilling it from the first only when it is empty. Each element moves at most twice, so both operations are O(1) amortised.

## Common mistakes

- Popping from an empty stack (underflow) or pushing onto a full array (overflow) without checking.
- Reversing the operands of - and / in postfix evaluation: 8 2 - means 8 - 2, not 2 - 8.
- Using a Python list as a queue with pop(0), which is O(n). Use collections.deque instead.
- Declaring a circular queue full when rear == n - 1; that ignores the cells freed at the front.`,
      },
      {
        title: 'Hashing and Collision Resolution',
        topic: 'Hashing',
        durationMin: 45,
        content: `# Hashing and Collision Resolution

A **hash table** stores key-value pairs in an array and uses a **hash function** to turn a key into an array index. Search, insertion and deletion take O(1) time on average, compared with O(log n) for a balanced tree.

## Hash functions and load factor

A good hash function is fast, deterministic and spreads keys uniformly. The simplest is the division method, h(k) = k mod m, where m is the table size; choosing m prime avoids patterns in the keys.

The **load factor** is alpha = n / m, the number of stored keys divided by the number of slots. It measures how full the table is and controls performance.

## Collisions

Two different keys can hash to the same slot. Since there are more possible keys than slots, collisions cannot be avoided, only handled.

### Separate chaining

Each slot holds a linked list of all keys that hash to it. The table never fills up, alpha may exceed 1, and the expected length of a chain is alpha. An unsuccessful search examines about 1 + alpha entries on average.

### Open addressing

All keys live in the array itself; on a collision we **probe** for another slot. Here alpha can never exceed 1.

| Method | Probe sequence for attempt i | Weakness |
|---|---|---|
| Linear probing | (h(k) + i) mod m | Primary clustering: long runs of occupied slots grow longer |
| Quadratic probing | (h(k) + i^2) mod m | Secondary clustering: keys with the same home slot follow the same path |
| Double hashing | (h1(k) + i x h2(k)) mod m | Slightly more computation; h2 must never be 0 |

## Worked example: linear probing

Table size m = 7, h(k) = k mod 7. Insert 50, 700, 76, 85, 92, 73, 101 in that order.

| Key | Home slot | Probes | Final slot |
|---|---|---|---|
| 50 | 1 | 1 | 1 |
| 700 | 0 | 0 | 0 |
| 76 | 6 | 6 | 6 |
| 85 | 1 | 1, 2 | 2 |
| 92 | 1 | 1, 2, 3 | 3 |
| 73 | 3 | 3, 4 | 4 |
| 101 | 3 | 3, 4, 5 | 5 |

Final table, slots 0 to 6: 700, 50, 85, 92, 73, 101, 76. The table is full (alpha = 1), and the keys 85, 92, 73 and 101 form one cluster: a clear picture of primary clustering.

## Deletion in open addressing

Simply emptying a slot would break the probe chain for keys stored beyond it. Instead the slot is marked with a **tombstone** (deleted marker): searches continue past it, and insertions may reuse it.

## Rehashing

When alpha passes a threshold (commonly about 0.7 for open addressing, 0.75 in Java's HashMap), the table is resized to roughly double and every key is reinserted with the new modulus. A single rehash costs O(n), but it happens rarely enough that insertion stays O(1) amortised.

## Complexity

| Operation | Average | Worst case |
|---|---|---|
| Search, insert, delete | O(1) | O(n), when all keys collide |

## Common mistakes

- Saying hashing gives O(1) in the worst case. That holds only on average, with a good hash function and a bounded load factor.
- Expecting a hash table to keep keys in sorted order or to answer range queries. Use a balanced tree for that.
- Forgetting to probe past tombstones during search.
- Using mutable objects as keys: if a key changes after insertion, its hash changes and it can no longer be found.
- Choosing m as a power of 2 with the division method, which uses only the low-order bits of the key.`,
      },
    ],
  },
  {
    title: 'Trees and Heaps',
    description: 'Ordered trees for searching, self-balancing with AVL rotations, and heaps for priority queues.',
    lessons: [
      {
        title: 'Binary Search Trees',
        topic: 'Binary Search Trees',
        durationMin: 40,
        content: `# Binary Search Trees

A **binary search tree (BST)** is a binary tree in which, for every node, all keys in the left subtree are smaller than the node's key and all keys in the right subtree are larger. The rule applies to whole subtrees, not just to the immediate children.

## Operations

Search, insertion and deletion all walk one path from the root, so they take **O(h)** time, where h is the height.

- A balanced tree with n nodes has h of about log2 n.
- A skewed tree, produced by inserting keys in sorted order, has h = n - 1 and behaves like a linked list.

\`\`\`python
def search(node, key):
    while node is not None and node.key != key:
        node = node.left if key < node.key else node.right
    return node
\`\`\`

## Worked example: building and traversing

Insert 50, 30, 70, 20, 40, 60, 80 into an empty BST.

\`\`\`text
          50
        /    \\
      30      70
     /  \\    /  \\
    20  40  60  80
\`\`\`

| Traversal | Order visited | Result |
|---|---|---|
| Inorder | left, root, right | 20 30 40 50 60 70 80 |
| Preorder | root, left, right | 50 30 20 40 70 60 80 |
| Postorder | left, right, root | 20 40 30 60 80 70 50 |
| Level order | level by level | 50 30 70 20 40 60 80 |

**The inorder traversal of a BST always gives the keys in sorted order.** This is the quickest way to check whether a tree is a valid BST.

## Deletion: three cases

1. **Leaf**: remove it.
2. **One child**: replace the node with its child.
3. **Two children**: copy in the **inorder successor** (the smallest key in the right subtree) or the inorder predecessor (the largest key in the left subtree), then delete that node, which has at most one child.

Deleting 50 from the tree above: the inorder successor is 60, so 60 becomes the root and the old 60 leaf is removed. The root's right child, 70, now has only the right child 80.

## Useful facts

- The minimum is the leftmost node; the maximum is the rightmost node.
- A BST can be rebuilt from its preorder (or postorder) traversal alone, because sorting it gives the inorder traversal.
- The number of structurally different BSTs with n distinct keys is the Catalan number: 1, 2, 5, 14, 42 for n = 1 to 5.
- A binary tree of height h (counting edges) has at most 2^(h + 1) - 1 nodes.

## Complexity

| Operation | Average | Worst case (skewed tree) |
|---|---|---|
| Search | O(log n) | O(n) |
| Insert | O(log n) | O(n) |
| Delete | O(log n) | O(n) |
| Inorder traversal | O(n) | O(n) |

Self-balancing trees such as AVL and red-black trees keep the height O(log n) and remove the bad worst case.

## Common mistakes

- Validating a BST by comparing each node only with its two children. A node deep in the left subtree may still be larger than the root. Pass down an allowed (minimum, maximum) range instead.
- Quoting O(log n) as the worst case of a plain BST. It is O(n).
- Choosing the wrong replacement when deleting a node with two children: it is the successor or predecessor, not an arbitrary child.
- Forgetting to decide how duplicates are handled; the usual convention is to reject them or to keep a count in the node.`,
      },
      {
        title: 'AVL Trees and Rotations',
        topic: 'AVL Trees',
        durationMin: 45,
        content: `# AVL Trees and Rotations

An **AVL tree** is a binary search tree that rebalances itself after every insertion and deletion, so its height is always O(log n). It is named after its inventors, Adelson-Velsky and Landis.

## Balance factor

For every node,

\`\`\`text
balance factor = height(left subtree) - height(right subtree)
\`\`\`

The tree is an AVL tree if every balance factor is -1, 0 or +1. An insertion can change the balance factors only of the nodes on the path back to the root. The first node on that path whose factor becomes +2 or -2 is the one to fix.

## The four cases

| Case | Where the new key went | Fix |
|---|---|---|
| LL | Left subtree of the left child | One right rotation |
| RR | Right subtree of the right child | One left rotation |
| LR | Right subtree of the left child | Left rotation on the child, then right rotation on the node |
| RL | Left subtree of the right child | Right rotation on the child, then left rotation on the node |

A rotation takes O(1) time and keeps the BST ordering. After an insertion, at most one single or double rotation restores balance for the whole tree. A deletion may need rotations at several levels on the way up.

## Worked example

Insert 10, 20, 30, 40, 50, 25 into an empty AVL tree.

**Insert 10, 20, 30.** The tree is a right-leaning chain and node 10 has balance factor -2. This is the RR case, so rotate left at 10:

\`\`\`text
      20
     /  \\
   10    30
\`\`\`

**Insert 40.** It becomes the right child of 30. All balance factors stay within range.

**Insert 50.** It becomes the right child of 40. Node 30 now has factor -2 (RR case). Rotate left at 30:

\`\`\`text
      20
     /  \\
   10    40
        /  \\
      30    50
\`\`\`

**Insert 25.** It becomes the left child of 30. Counting a single node as height 0, the root 20 now has a left subtree of height 0 and a right subtree of height 2, a factor of -2. The new key lies in the **left** subtree of the **right** child: the RL case. Rotate right at 40, then rotate left at 20:

\`\`\`text
        30
      /    \\
    20      40
   /  \\       \\
 10    25      50
\`\`\`

The final root is 30 and the inorder traversal is still 10 20 25 30 40 50.

## How small can an AVL tree be?

Let N(h) be the minimum number of nodes in an AVL tree of height h, where a single node has height 0. The sparsest tree has one subtree of height h - 1 and the other of height h - 2:

\`\`\`text
N(h) = N(h - 1) + N(h - 2) + 1,   N(0) = 1,   N(1) = 2
\`\`\`

This gives 1, 2, 4, 7, 12, 20 for h = 0 to 5. The Fibonacci-like growth is why the height is at most about 1.44 x log2 n.

## AVL versus red-black trees

AVL trees are more strictly balanced, so lookups are slightly faster; red-black trees perform fewer rotations on updates. Lookup-heavy workloads favour AVL; many standard-library maps use red-black trees.

## Common mistakes

- Using a single rotation for the LR or RL case. A zig-zag shape needs a double rotation.
- Computing the balance factor from node counts instead of heights.
- Forgetting to update stored heights after a rotation, from the bottom up.
- Rotating at the root every time. Rotate at the **lowest** unbalanced ancestor of the inserted node.`,
      },
      {
        title: 'Heaps and Priority Queues',
        topic: 'Heaps',
        durationMin: 45,
        content: `# Heaps and Priority Queues

A **binary heap** is a complete binary tree that satisfies the heap property. In a **max-heap** every node is greater than or equal to its children, so the largest element is at the root; a **min-heap** is the mirror image. A heap is only partially ordered: siblings have no fixed order.

## Array representation

Because the tree is complete, it is stored in an array with no pointers. With indexes starting at 0, for the node at index i:

\`\`\`text
left child  = 2i + 1
right child = 2i + 2
parent      = floor((i - 1) / 2)
\`\`\`

In a heap of n elements the leaves occupy indexes floor(n / 2) to n - 1.

## Operations

| Operation | Method | Time |
|---|---|---|
| Find max | Read the root | O(1) |
| Insert | Append at the end, then **sift up** | O(log n) |
| Extract max | Move the last element to the root, then **sift down** | O(log n) |
| Build heap | Sift down every internal node, from the last one up to the root | O(n) |

Building a heap is O(n), not O(n log n): most nodes are near the bottom and move only a short distance.

## Worked example

**Build a max-heap from [4, 10, 3, 5, 1].** Here n = 5, so the last internal node is at index floor(5 / 2) - 1 = 1.

- Index 1 (value 10): its children are 5 and 1, so no swap is needed.
- Index 0 (value 4): its children are 10 and 3. Swap with 10 to get [10, 4, 3, 5, 1]. The 4, now at index 1, has children 5 and 1; swap with 5.

Result: **[10, 5, 3, 4, 1]**.

**Insert 9.** Append it: [10, 5, 3, 4, 1, 9]. Its parent is index 2 (value 3), which is smaller, so swap: [10, 5, 9, 4, 1, 3]. The next parent is 10, so stop.

**Extract the maximum from [10, 5, 3, 4, 1].** Remove 10 and move the last element, 1, to the root: [1, 5, 3, 4]. Sift down: swap 1 with its larger child 5, then with 4. Result: **[5, 4, 3, 1]**.

## Heap sort

1. Build a max-heap in O(n).
2. Repeatedly swap the root with the last element of the heap, shrink the heap by one and sift the new root down.

Heap sort runs in O(n log n) in every case and sorts in place with O(1) extra space, but it is **not stable**.

## Priority queues

A priority queue returns the element with the highest priority rather than the oldest one. A heap is the usual implementation and is at the core of Dijkstra's shortest-path algorithm, Prim's algorithm, Huffman coding and event-driven simulation.

### The k largest elements

Keep a **min-heap of size k**. For each new element, if it is larger than the root, replace the root and sift down. The heap always holds the k largest values seen so far, and the total time is O(n log k).

## Common mistakes

- Treating a heap as a sorted array. Only the root is guaranteed to be the extreme value.
- Searching a heap for an arbitrary key in O(log n). There is no ordering between subtrees, so search is O(n).
- Building a heap by n separate insertions when the bottom-up method is asymptotically faster.
- Sifting down towards the smaller child in a max-heap; always swap with the **larger** child.`,
      },
    ],
  },
  {
    title: 'Graphs and Algorithm Design',
    description: 'Exploring graphs with BFS and DFS, computing shortest paths, and solving optimisation problems with dynamic programming.',
    lessons: [
      {
        title: 'Graph Traversal: BFS and DFS',
        topic: 'Graph Traversal',
        durationMin: 45,
        content: `# Graph Traversal: BFS and DFS

A graph G = (V, E) is a set of vertices joined by edges. Traversal means visiting every vertex reachable from a starting vertex exactly once. The two standard strategies differ in the data structure that holds the vertices waiting to be explored.

## Representing a graph

| Representation | Space | Test whether edge (u, v) exists | List the neighbours of u |
|---|---|---|---|
| Adjacency matrix | O(V^2) | O(1) | O(V) |
| Adjacency list | O(V + E) | O(degree of u) | O(degree of u) |

Adjacency lists suit sparse graphs, which are the common case; matrices suit dense graphs.

## Breadth-first search (BFS)

BFS uses a **queue**. It visits the start vertex, then all vertices one edge away, then all vertices two edges away, and so on. For that reason BFS finds the **shortest path in an unweighted graph**, measured in number of edges.

\`\`\`python
from collections import deque

def bfs(graph, start):
    visited = {start}
    order = []
    queue = deque([start])
    while queue:
        u = queue.popleft()
        order.append(u)
        for v in graph[u]:
            if v not in visited:
                visited.add(v)
                queue.append(v)
    return order
\`\`\`

A vertex is marked visited when it is **added** to the queue, not when it is removed; otherwise the same vertex could be queued several times.

## Depth-first search (DFS)

DFS uses a **stack**, usually the recursion stack. It goes as deep as possible along one path and backtracks only when it reaches a vertex with no unvisited neighbour.

## Worked example

Undirected graph with edges A-B, A-C, B-D, C-D and D-E. Neighbours are taken in alphabetical order, starting at A.

**BFS**

| Step | Dequeued | Queue afterwards |
|---|---|---|
| 1 | A | B, C |
| 2 | B | C, D |
| 3 | C | D |
| 4 | D | E |
| 5 | E | empty |

BFS order: **A, B, C, D, E**. The levels are A = 0; B and C = 1; D = 2; E = 3, so the shortest path from A to E has 3 edges.

**DFS**

From A go to B, from B to D, and from D to C (B is already visited). C has no unvisited neighbour, so backtrack to D and visit E.

DFS order: **A, B, D, C, E**.

## Complexity

With an adjacency list both traversals run in **O(V + E)** time: every vertex is processed once and every edge is examined once (twice if undirected). With an adjacency matrix the time is O(V^2). Both need O(V) extra space.

## Applications

| BFS | DFS |
|---|---|
| Shortest path in unweighted graphs | Cycle detection |
| Level-order traversal of a tree | Topological sorting of a DAG |
| Checking whether a graph is bipartite | Finding connected and strongly connected components |
| Finding all nodes within k hops | Solving mazes and puzzles by backtracking |

A **topological order** lists the vertices of a directed acyclic graph so that every edge goes from an earlier vertex to a later one. It exists only if the graph has no cycle.

## Common mistakes

- Omitting the visited set. On a graph with a cycle the traversal never terminates.
- Using DFS to find shortest paths. DFS finds a path, not necessarily the shortest one.
- Forgetting disconnected graphs. To visit everything, start a new traversal from every vertex that is still unvisited.
- Stating the complexity as O(V x E). With adjacency lists it is O(V + E).`,
      },
      {
        title: 'Shortest Paths: Dijkstra and Bellman-Ford',
        topic: 'Shortest Paths',
        durationMin: 45,
        content: `# Shortest Paths: Dijkstra and Bellman-Ford

In a weighted graph the length of a path is the sum of its edge weights. The **single-source shortest-path** problem asks for the cheapest path from one start vertex to every other vertex.

## Relaxation

Every algorithm in this lesson is built on one step. For an edge (u, v) with weight w:

\`\`\`text
if dist[u] + w < dist[v]:
    dist[v] = dist[u] + w
    parent[v] = u
\`\`\`

## Dijkstra's algorithm

Dijkstra is a **greedy** algorithm for graphs with **non-negative** edge weights.

1. Set dist[source] = 0 and every other distance to infinity.
2. Repeatedly pick the unvisited vertex with the smallest tentative distance; that distance is now final.
3. Relax every edge leaving the chosen vertex.

With a binary-heap priority queue the running time is O((V + E) log V); with a plain array it is O(V^2), which is acceptable for dense graphs.

### Worked example

Undirected graph with weighted edges A-B 4, A-C 1, C-B 2, B-D 1, C-D 5. The source is A.

| Step | Vertex finalised | dist A | dist B | dist C | dist D |
|---|---|---|---|---|---|
| Start | - | 0 | inf | inf | inf |
| 1 | A | 0 | 4 | 1 | inf |
| 2 | C | 0 | 3 | 1 | 6 |
| 3 | B | 0 | 3 | 1 | 4 |
| 4 | D | 0 | 3 | 1 | 4 |

- After finalising C (distance 1), B improves to 1 + 2 = 3 and D becomes 1 + 5 = 6.
- After finalising B (distance 3), D improves to 3 + 1 = 4.

The shortest path from A to D is **A, C, B, D with total weight 4**. It uses three edges, although the two-edge path A, C, D exists with weight 6. Fewer edges does not mean a shorter path.

## Why negative weights break Dijkstra

Once a vertex is finalised, Dijkstra never revisits it. With a negative edge, a path through a vertex finalised later could turn out cheaper, and the earlier decision would be wrong.

## Bellman-Ford

Bellman-Ford relaxes **every edge V - 1 times**. A shortest path has at most V - 1 edges, so that many passes are enough. If a further pass still improves some distance, the graph contains a **negative-weight cycle** reachable from the source, and no shortest path exists. The running time is O(V x E).

## Choosing an algorithm

| Situation | Algorithm | Time |
|---|---|---|
| Unweighted graph | BFS | O(V + E) |
| Non-negative weights | Dijkstra with a heap | O((V + E) log V) |
| Negative weights, no negative cycle | Bellman-Ford | O(V x E) |
| Directed acyclic graph | Relax in topological order | O(V + E) |
| All pairs of vertices | Floyd-Warshall | O(V^3) |

Floyd-Warshall is a dynamic-programming algorithm: for each intermediate vertex k it checks whether going through k shortens the path from i to j.

## Common mistakes

- Running Dijkstra on a graph with a negative edge and trusting the result.
- Believing that adding a constant to every weight fixes negative edges. It penalises paths with more edges and can change which path is shortest.
- Finalising a vertex when it is first discovered. A vertex is final only when it is removed from the priority queue with the minimum distance.
- Forgetting to skip stale queue entries when a heap contains several entries for the same vertex.
- Confusing a negative edge with a negative cycle. Bellman-Ford handles the first and reports the second.`,
      },
      {
        title: 'Dynamic Programming',
        topic: 'Dynamic Programming',
        durationMin: 50,
        content: `# Dynamic Programming

Dynamic programming (DP) solves a problem by combining the answers to smaller subproblems and **storing** each answer so it is computed only once. It applies when a problem has two properties:

1. **Overlapping subproblems**: the same subproblem is needed again and again.
2. **Optimal substructure**: an optimal solution is built from optimal solutions of its subproblems.

Divide and conquer (merge sort, for example) has subproblems that do not overlap, so storing them gains nothing. A greedy algorithm commits to one choice without comparing alternatives; DP compares them all.

## Two styles

| Style | How | Notes |
|---|---|---|
| Memoisation (top-down) | Write the recursion, cache each result | Solves only the subproblems actually needed; uses the recursion stack |
| Tabulation (bottom-up) | Fill a table from the smallest subproblems upward | No recursion; often allows the table to be shrunk |

### Example: Fibonacci

The naive recursion fib(n) = fib(n - 1) + fib(n - 2) recomputes the same values and takes exponential time. Storing results reduces it to O(n) time, and keeping only the last two values reduces space to O(1).

## Worked example 1: 0/1 knapsack

Capacity 5. Items as (weight, value): (1, 6), (2, 10), (3, 12). Each item may be taken at most once.

Let dp[i][w] be the best value using the first i items with capacity w:

\`\`\`text
dp[i][w] = max( dp[i-1][w],                         skip item i
                value[i] + dp[i-1][w - weight[i]] ) take item i, if it fits
\`\`\`

| Capacity w | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| No items | 0 | 0 | 0 | 0 | 0 | 0 |
| Item 1 (1, 6) | 0 | 6 | 6 | 6 | 6 | 6 |
| Items 1-2 | 0 | 6 | 10 | 16 | 16 | 16 |
| Items 1-3 | 0 | 6 | 10 | 16 | 18 | 22 |

The answer is **22**, from the items of weight 2 and 3. A greedy choice by value per unit weight would take item 1 (ratio 6) and item 2 (ratio 5) for only 16. Time and space are O(n x W).

\`\`\`python
def knapsack(items, capacity):
    dp = [0] * (capacity + 1)
    for weight, value in items:
        for w in range(capacity, weight - 1, -1):
            dp[w] = max(dp[w], value + dp[w - weight])
    return dp[capacity]
\`\`\`

The inner loop runs **downwards** so that each item is used at most once.

## Worked example 2: coin change

Coins {1, 3, 4}, amount 6. Greedy takes 4 + 1 + 1, which is 3 coins. DP uses dp[a] = 1 + min(dp[a - c]) over all coins c and finds 3 + 3, which is **2 coins**.

## Worked example 3: longest common subsequence

For strings X and Y:

- if the last characters match, L[i][j] = L[i-1][j-1] + 1;
- otherwise L[i][j] = max(L[i-1][j], L[i][j-1]).

For X = ABCBDAB and Y = BDCABA the length is **4** (one such subsequence is BCBA). The time is O(m x n).

## A recipe for DP problems

1. Define the state: what does dp[i] or dp[i][j] mean, in one sentence?
2. Write the recurrence.
3. Fix the base cases.
4. Choose an order that computes smaller states first.
5. Say where the final answer is stored.

## Common mistakes

- Defining the state vaguely. If you cannot say what dp[i] means, the recurrence will be wrong.
- Iterating the 1-D knapsack upwards, which lets one item be used repeatedly (that solves the unbounded version).
- Confusing a subsequence (characters need not be adjacent) with a substring (they must be).
- Using a greedy method where DP is required, as in the coin example.`,
      },
    ],
  },
];
