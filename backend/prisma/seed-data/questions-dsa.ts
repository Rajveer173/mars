import { fill, multi, single, subj, tf, type SeedQuestion } from './types.js';

// Order matters inside a lesson: the midterm takes the first two questions of
// every lesson, quizzes take the auto-graded ones in order.
const BIGO = 'Complexity Analysis';
const STACK = 'Stacks and Queues';
const HASH = 'Hashing';
const BST = 'Binary Search Trees';
const AVL = 'AVL Trees';
const HEAP = 'Heaps';
const GRAPH = 'Graph Traversal';
const PATHS = 'Shortest Paths';
const DP = 'Dynamic Programming';

export const DSA_QUESTIONS: SeedQuestion[] = [
  // --- Complexity Analysis
  single(BIGO, 'EASY', 'REMEMBER', 'What is the worst-case time complexity of binary search on a sorted array of n elements?',
    ['O(1)', 'O(n)', 'O(log n)', 'O(n log n)'],
    2, 'Each comparison halves the search range, so at most about log2 n comparisons are needed.', ['complexity', 'binary-search']),
  single(BIGO, 'MEDIUM', 'APPLY', 'What is the solution of the recurrence T(n) = 2T(n/2) + n?',
    ['Theta(n)', 'Theta(n^2)', 'Theta(log n)', 'Theta(n log n)'],
    3, 'Here a = 2 and b = 2, so n^(log_b a) = n, the same order as f(n) = n. The Master theorem gives Theta(n log n), as in merge sort.', ['complexity', 'recurrence']),
  single(BIGO, 'HARD', 'ANALYZE', 'An outer loop runs i from 1 to n. Inside it, an inner loop starts j at 1 and doubles j while j <= n. What is the total time complexity?',
    ['O(n)', 'O(n log n)', 'O(n^2)', 'O(log n)'],
    1, 'The inner loop runs about log2 n times for each of the n outer iterations, and nested loops multiply: O(n log n).', ['complexity', 'loops']),

  // --- Stacks and Queues
  single(STACK, 'EASY', 'REMEMBER', 'Which data structure removes elements in first-in, first-out order?',
    ['Stack', 'Queue', 'Binary heap', 'Hash table'],
    1, 'A queue is FIFO: elements leave in the order they arrived. A stack is LIFO.', ['queue', 'stack']),
  fill(STACK, 'MEDIUM', 'APPLY', 'A circular queue is stored in an array of size 8 and is considered full when (rear + 1) mod n == front. It can hold at most ______ elements.',
    ['7', 'seven'], ['8', '6', '9'],
    'One cell is left unused so that a full queue can be told apart from an empty one: n - 1 = 7 elements.', ['queue', 'circular-queue']),
  single(STACK, 'MEDIUM', 'APPLY', 'What is the value of the postfix expression 5 3 + 8 2 - * ?',
    ['16', '40', '64', '48'],
    3, '5 3 + gives 8; 8 2 - gives 6; 8 x 6 = 48.', ['stack', 'postfix']),

  // --- Hashing
  single(HASH, 'MEDIUM', 'APPLY', 'The keys 50, 700, 76 and 85 are inserted in that order into a hash table of size 7 using h(k) = k mod 7 and linear probing. In which slot is 85 stored?',
    ['1', '3', '2', '6'],
    2, '50 goes to slot 1, 700 to slot 0 and 76 to slot 6. 85 mod 7 = 1 is occupied, so linear probing places it in slot 2.', ['hashing', 'linear-probing']),
  single(HASH, 'EASY', 'REMEMBER', 'The load factor of a hash table is defined as:',
    ['the number of stored keys divided by the number of slots', 'the number of slots divided by the number of stored keys', 'the number of collisions divided by the number of keys', 'the length of the longest chain'],
    0, 'alpha = n / m. It measures how full the table is and drives the expected cost of every operation.', ['hashing', 'load-factor']),
  multi(HASH, 'MEDIUM', 'UNDERSTAND', 'Which of the following are open-addressing techniques for resolving collisions? Select all that apply.',
    ['Linear probing', 'Separate chaining', 'Quadratic probing', 'Double hashing'],
    [0, 2, 3], 'Open addressing keeps every key inside the array and probes for another slot. Separate chaining stores colliding keys in a list outside the array.', ['hashing', 'collisions']),

  // --- Binary Search Trees
  single(BST, 'EASY', 'REMEMBER', 'Which traversal of a binary search tree visits the keys in ascending order?',
    ['Preorder', 'Postorder', 'Level order', 'Inorder'],
    3, 'Inorder visits the left subtree, the node, then the right subtree, which for a BST is sorted order.', ['bst', 'traversal']),
  tf(BST, 'MEDIUM', 'UNDERSTAND', 'Searching a plain (unbalanced) binary search tree takes O(log n) time in the worst case.',
    false, 'Search costs O(h). A tree built from sorted keys is a chain of height n - 1, so the worst case is O(n).', ['bst', 'complexity']),
  single(BST, 'MEDIUM', 'APPLY', 'The keys 50, 30, 70, 20, 40, 60, 80 are inserted in that order into an empty binary search tree. What is its preorder traversal?',
    ['20 30 40 50 60 70 80', '50 30 20 40 70 60 80', '20 40 30 60 80 70 50', '50 30 70 20 40 60 80'],
    1, 'Preorder visits root, left subtree, right subtree: 50, then 30 20 40, then 70 60 80.', ['bst', 'traversal']),

  // --- AVL Trees
  single(AVL, 'MEDIUM', 'REMEMBER', 'In an AVL tree, the balance factor of every node must be:',
    ['exactly 0', '-1, 0 or +1', 'between -2 and +2', 'any non-negative value'],
    1, 'The heights of the two subtrees of any node may differ by at most 1.', ['avl', 'balance-factor']),
  single(AVL, 'HARD', 'APPLY', 'The keys 10, 20 and 30 are inserted in that order into an empty AVL tree. Which rotation restores balance, and what is the new root?',
    ['A right rotation at 30; the root becomes 20', 'A left-right double rotation; the root becomes 10', 'No rotation is needed; the root stays 10', 'A left rotation at 10; the root becomes 20'],
    3, 'The keys form a right-leaning chain (the RR case), so a single left rotation at 10 makes 20 the root with children 10 and 30.', ['avl', 'rotations']),
  single(AVL, 'EXPERT', 'ANALYZE', 'Taking the height of a single node as 0, what is the minimum number of nodes in an AVL tree of height 4?',
    ['7', '15', '12', '16'],
    2, 'N(h) = N(h - 1) + N(h - 2) + 1 with N(0) = 1 and N(1) = 2 gives 4, 7 and then 12 for height 4.', ['avl', 'height']),

  // --- Heaps
  single(HEAP, 'EASY', 'REMEMBER', 'In a 0-indexed array representation of a binary heap, the children of the node at index i are at indexes:',
    ['i + 1 and i + 2', '2i and 2i + 1', '2i + 1 and 2i + 2', 'i / 2 and i / 2 + 1'],
    2, 'With indexes starting at 0, the left child is at 2i + 1 and the right child at 2i + 2.', ['heap', 'array-representation']),
  single(HEAP, 'MEDIUM', 'REMEMBER', 'What is the time complexity of building a heap from n unordered elements with the bottom-up method?',
    ['O(log n)', 'O(n)', 'O(n log n)', 'O(n^2)'],
    1, 'Most nodes are near the leaves and sift down only a short distance; the total work sums to O(n).', ['heap', 'build-heap']),
  single(HEAP, 'HARD', 'APPLY', 'A max-heap is built bottom-up from the array [4, 10, 3, 5, 1]. What is the resulting array?',
    ['[10, 5, 3, 4, 1]', '[10, 4, 3, 5, 1]', '[10, 5, 4, 3, 1]', '[1, 3, 4, 5, 10]'],
    0, 'Index 1 (10) is already larger than its children. At index 0, 4 swaps with 10 and then with 5, giving [10, 5, 3, 4, 1].', ['heap', 'build-heap']),

  // --- Graph Traversal
  single(GRAPH, 'EASY', 'REMEMBER', 'Which data structure does breadth-first search use to hold the vertices waiting to be explored?',
    ['Stack', 'Priority queue', 'Queue', 'Hash table'],
    2, 'BFS processes vertices in the order they were discovered, which is exactly a FIFO queue. DFS uses a stack.', ['graph', 'bfs']),
  single(GRAPH, 'MEDIUM', 'APPLY', 'An undirected graph has the edges A-B, A-C, B-D, C-D and D-E. Starting at A and taking neighbours in alphabetical order, what is the depth-first search order?',
    ['A, B, C, D, E', 'A, C, D, B, E', 'A, B, D, E, C', 'A, B, D, C, E'],
    3, 'From A go to B, then D. From D the first unvisited neighbour is C; after backtracking to D, E is visited last.', ['graph', 'dfs']),
  tf(GRAPH, 'EASY', 'UNDERSTAND', 'Breadth-first search finds a path with the fewest edges between two vertices of an unweighted graph.',
    true, 'BFS explores vertices level by level, so the first time it reaches a vertex is along a path with the minimum number of edges.', ['graph', 'bfs']),

  // --- Shortest Paths
  single(PATHS, 'MEDIUM', 'UNDERSTAND', 'Dijkstra\'s algorithm can produce wrong answers when the graph contains:',
    ['cycles', 'negative edge weights', 'more edges than vertices', 'undirected edges'],
    1, 'Dijkstra finalises a vertex when it is removed from the queue; a negative edge found later could offer a cheaper path it never reconsiders.', ['shortest-path', 'dijkstra']),
  single(PATHS, 'HARD', 'APPLY', 'A graph has the weighted undirected edges A-B 4, A-C 1, C-B 2, B-D 1 and C-D 5. What is the length of the shortest path from A to D?',
    ['4', '5', '6', '7'],
    0, 'The path A, C, B, D costs 1 + 2 + 1 = 4, which beats A, B, D (5) and A, C, D (6).', ['shortest-path', 'dijkstra']),
  subj(PATHS, 'HARD', 'EVALUATE', 'Using a small example, explain why Dijkstra\'s algorithm can fail on a graph with a negative edge weight, and name an algorithm that handles such graphs correctly.',
    'Model answer. Dijkstra finalises the closest unvisited vertex and never revisits it. Example: edges S->A 2, A->C 1, S->B 5, B->A -4. Dijkstra finalises A at 2 and C at 3 before it processes B, but the path S, B, A, C costs 5 - 4 + 1 = 2. Bellman-Ford relaxes every edge V - 1 times, handles negative edges and detects negative cycles. Award 2 marks for the reason, 2 for a valid example and 1 for the alternative.',
    {
      good: 'Dijkstra is greedy: when it removes the vertex with the smallest tentative distance it treats that distance as final, which is only valid if no later edge can reduce a path. Example: S->A with weight 2, A->C with weight 1, S->B with weight 5 and B->A with weight -4. Dijkstra finalises A at distance 2 and then C at distance 3. Only afterwards does it process B, so it never finds the path S, B, A, C of cost 2. Bellman-Ford handles negative weights by relaxing all edges V - 1 times, and one more pass detects a negative cycle.',
      partial: 'Dijkstra assumes that once a node is visited its distance cannot get smaller. With a negative edge this may not be true, so the answer can be wrong. Bellman-Ford should be used instead.',
      weak: 'Dijkstra fails with negative weights because distances cannot be negative. We can add a constant to all the weights to make them positive and then use Dijkstra.',
    }, ['shortest-path', 'dijkstra', 'bellman-ford']),

  // --- Dynamic Programming
  multi(DP, 'MEDIUM', 'UNDERSTAND', 'Which properties must a problem have for dynamic programming to be applicable? Select all that apply.',
    ['Overlapping subproblems', 'Optimal substructure', 'The greedy-choice property', 'Subproblems that never repeat'],
    [0, 1], 'DP needs subproblems that recur (so storing them helps) and an optimal solution composed of optimal sub-solutions.', ['dynamic-programming']),
  subj(DP, 'HARD', 'ANALYZE', 'Explain the difference between memoisation and tabulation. Then write the recurrence for the 0/1 knapsack problem and state its time complexity.',
    'Model answer. Memoisation is top-down: write the recursive solution and cache each subproblem result, computing only the states that are reached. Tabulation is bottom-up: fill a table iteratively from the base cases, with no recursion. Knapsack: dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w - weight[i]]) when weight[i] <= w, otherwise dp[i-1][w]; dp[0][w] = 0. Time O(n x W). Award 2 marks for the comparison, 2 for the recurrence and 1 for the complexity.',
    {
      good: 'Memoisation is the top-down style: we keep the natural recursion but store the answer of each subproblem in a table the first time it is computed, so only the needed states are solved, at the cost of recursion-stack space. Tabulation is bottom-up: we fill the table in order from the smallest subproblems, with loops and no recursion, which often lets us reduce the space. 0/1 knapsack: dp[i][w] = max(dp[i-1][w], value[i] + dp[i-1][w - weight[i]]) if weight[i] <= w, else dp[i][w] = dp[i-1][w], with dp[0][w] = 0. There are n x W states with constant work each, so the time is O(n x W).',
      partial: 'Memoisation uses recursion and stores results, while tabulation uses a table and loops. For knapsack we take the maximum of including the item or not including it: dp[i][w] = max(include, exclude). The time complexity is O(n^2).',
      weak: 'Memoisation and tabulation are both dynamic programming. Knapsack is solved by sorting the items by value and picking the best ones until the bag is full.',
    }, ['dynamic-programming', 'knapsack']),
  single(DP, 'HARD', 'APPLY', 'In a 0/1 knapsack problem the capacity is 5 and the items, as (weight, value), are (1, 6), (2, 10) and (3, 12). What is the maximum total value?',
    ['16', '18', '22', '28'],
    2, 'Taking the items of weight 2 and 3 fills the knapsack exactly with value 10 + 12 = 22. The other feasible pairs give 16 and 18.', ['dynamic-programming', 'knapsack']),
  fill(DP, 'MEDIUM', 'APPLY', 'Using coins of value 1, 3 and 4, the minimum number of coins needed to make the amount 6 is ______.',
    ['2', 'two'], ['3', '4', '1'],
    'Two coins of value 3 make 6. A greedy choice of 4 + 1 + 1 would use three coins.', ['dynamic-programming', 'coin-change']),
];
