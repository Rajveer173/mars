import { fill, multi, single, subj, tf, type SeedQuestion } from './types.js';

// Order matters inside a lesson: the midterm takes the first two questions of
// every lesson, quizzes take the auto-graded ones in order.
const KEYS = 'Relational Model and Keys';
const SQL = 'SQL Joins and Aggregation';
const ER = 'ER Modelling';
const FD = 'Functional Dependencies';
const NF = 'Normalisation';
const BCNF = 'BCNF and Lossless Decomposition';
const ACID = 'Transactions and ACID';
const ISO = 'Isolation Levels and Concurrency';
const BTREE = 'B+ Tree Indexing';

export const DBMS_QUESTIONS: SeedQuestion[] = [
  // --- Relational Model and Keys
  single(KEYS, 'EASY', 'REMEMBER', 'Which of the following best defines a candidate key?',
    ['Any set of attributes that uniquely identifies a tuple', 'A minimal super key', 'A key that references another relation', 'A key whose attributes may be NULL'],
    1, 'A candidate key is a super key from which no attribute can be removed without losing uniqueness.', ['keys']),
  single(KEYS, 'MEDIUM', 'APPLY', 'A relation R(A, B, C, D) has A as its only candidate key. How many super keys does R have?',
    ['4', '15', '8', '16'],
    2, 'Every super key must contain A; each of the other 3 attributes may be present or absent, giving 2^3 = 8 super keys.', ['keys', 'counting']),
  tf(KEYS, 'EASY', 'UNDERSTAND', 'A foreign key column may contain NULL unless it is declared NOT NULL.',
    true, 'Referential integrity requires a foreign key value to match an existing primary key value or be NULL.', ['keys', 'integrity']),

  // --- SQL Joins and Aggregation
  single(SQL, 'EASY', 'REMEMBER', 'Which SQL clause filters groups after aggregation has been performed?',
    ['WHERE', 'ORDER BY', 'DISTINCT', 'HAVING'],
    3, 'WHERE filters rows before grouping; HAVING filters the groups produced by GROUP BY.', ['sql', 'aggregation']),
  multi(SQL, 'MEDIUM', 'UNDERSTAND', 'Which statements about NULL values and aggregate functions in SQL are correct? Select all that apply.',
    ['COUNT(*) counts a row even when its columns are NULL', 'COUNT(column) ignores NULL values', 'AVG treats NULL as zero', 'The comparison column = NULL is true when the column is NULL'],
    [0, 1], 'COUNT(*) counts rows and COUNT(column) counts non-NULL values. AVG ignores NULLs, and = NULL is never true; IS NULL must be used.', ['sql', 'null']),
  single(SQL, 'MEDIUM', 'APPLY', 'Student has 4 rows and Enrolment has 4 rows. Every enrolment belongs to an existing student, and exactly one student has no enrolment. How many rows does Student LEFT JOIN Enrolment ON roll_no return?',
    ['16', '4', '5', '8'],
    2, 'The 4 enrolments each match one student (4 rows), and the student without enrolments appears once with NULLs: 5 rows.', ['sql', 'joins']),

  // --- ER Modelling
  single(ER, 'EASY', 'REMEMBER', 'How is a many-to-many relationship mapped to the relational model?',
    ['A foreign key on either side', 'A foreign key on both sides', 'A separate table containing the primary keys of both entities', 'It cannot be represented'],
    2, 'An M:N relationship becomes its own table whose primary key combines the two foreign keys; relationship attributes are stored there.', ['er-model', 'mapping']),
  single(ER, 'MEDIUM', 'APPLY', 'An ER diagram has 3 strong entities, 1 weak entity, two 1:N relationships, one M:N relationship and one multivalued attribute. What is the minimum number of tables needed?',
    ['8', '7', '5', '6'],
    3, '3 strong entities + 1 weak entity + 1 table for the M:N relationship + 1 for the multivalued attribute = 6. The 1:N relationships become foreign keys.', ['er-model', 'mapping']),
  fill(ER, 'MEDIUM', 'REMEMBER', 'The primary key of the table for a weak entity is the owner entity\'s key combined with the weak entity\'s ______ key.',
    ['partial', 'partial key', 'discriminator'], ['foreign', 'candidate', 'surrogate'],
    'A weak entity has only a partial key (discriminator); together with the owner\'s key it identifies a row.', ['er-model', 'weak-entity']),

  // --- Functional Dependencies
  single(FD, 'MEDIUM', 'APPLY', 'R(A, B, C, D, E) has the dependencies A -> BC, CD -> E, B -> D and E -> A. What is the closure of {B}?',
    ['{B}', '{B, D}', '{B, C, D}', '{A, B, C, D, E}'],
    1, 'Starting from {B}, only B -> D applies, giving {B, D}. CD -> E needs C, which is not available.', ['functional-dependency', 'closure']),
  single(FD, 'EXPERT', 'ANALYZE', 'R(A, B, C, D, E) has the dependencies A -> BC, CD -> E, B -> D and E -> A. Which of the following is NOT a candidate key of R?',
    ['A', 'BD', 'E', 'BC'],
    1, 'A+, E+, BC+ and CD+ all contain every attribute, but BD+ = {B, D}. The candidate keys are A, E, BC and CD.', ['functional-dependency', 'candidate-key']),
  tf(FD, 'MEDIUM', 'UNDERSTAND', 'If the dependency AB -> C holds, then A -> C must also hold.',
    false, 'A composite left-hand side cannot be split: AB together determine C, but A alone need not.', ['functional-dependency']),

  // --- Normalisation
  single(NF, 'EASY', 'REMEMBER', 'A relation in 1NF is also in 2NF when it has no:',
    ['transitive dependency on a key', 'partial dependency of a non-prime attribute on a candidate key', 'multivalued attribute', 'foreign key'],
    1, '2NF forbids a non-prime attribute from depending on only part of a candidate key.', ['normalisation', '2nf']),
  subj(NF, 'HARD', 'ANALYZE', 'OrderLine(order_id, product_id, customer_id, customer_city, product_name, quantity) has the key (order_id, product_id) and the dependencies order_id -> customer_id; customer_id -> customer_city; product_id -> product_name; (order_id, product_id) -> quantity. Decompose the relation into 3NF, stating which kind of dependency each step removes.',
    'Model answer. 2NF step (remove partial dependencies on part of the key): Order(order_id, customer_id, customer_city), Product(product_id, product_name), OrderLine(order_id, product_id, quantity). 3NF step (remove the transitive dependency order_id -> customer_id -> customer_city): Order(order_id, customer_id) and Customer(customer_id, customer_city). Final schema: Order, Customer, Product, OrderLine. Award 2 marks for the 2NF step, 2 for the 3NF step and 1 for naming the dependencies.',
    {
      good: 'The key is (order_id, product_id). customer_id depends only on order_id and product_name only on product_id, which are partial dependencies, so for 2NF I split into Order(order_id, customer_id, customer_city), Product(product_id, product_name) and OrderLine(order_id, product_id, quantity). In Order, order_id -> customer_id -> customer_city is a transitive dependency, so for 3NF I split it into Order(order_id, customer_id) and Customer(customer_id, customer_city). Final tables: Order, Customer, Product, OrderLine.',
      partial: 'There are partial dependencies because product_name depends on product_id only. So I make Product(product_id, product_name) and OrderLine(order_id, product_id, quantity), and Order(order_id, customer_id, customer_city). This is now in 3NF.',
      weak: 'The table is not normalised because it has many columns. I would split it into two tables, one for orders and one for products, to remove redundancy.',
    }, ['normalisation', '3nf', 'decomposition']),
  single(NF, 'MEDIUM', 'APPLY', 'Result(roll_no, course_code, student_name, grade) has the key (roll_no, course_code) and the dependency roll_no -> student_name. What is the highest normal form the relation satisfies?',
    ['1NF', '2NF', '3NF', 'BCNF'],
    0, 'student_name depends on roll_no alone, a partial dependency on part of the key, so the relation is in 1NF but not in 2NF.', ['normalisation', '2nf']),

  // --- BCNF and Lossless Decomposition
  single(BCNF, 'MEDIUM', 'UNDERSTAND', 'A relation is in BCNF if, for every non-trivial functional dependency X -> Y:',
    ['Y is a prime attribute', 'X is a single attribute', 'Y is a super key', 'X is a super key'],
    3, 'BCNF allows no exception: the left-hand side of every non-trivial dependency must be a super key.', ['bcnf']),
  single(BCNF, 'HARD', 'ANALYZE', 'R(A, B, C) has the single dependency A -> B. Which decomposition of R is lossless?',
    ['(A, B) and (A, C)', '(A, B) and (B, C)', '(A, C) and (B, C)', 'None of these'],
    0, 'The common attribute A determines B, so A is a key of (A, B) and the join is lossless. In the other splits the common attribute determines neither side.', ['bcnf', 'lossless-join']),
  multi(BCNF, 'HARD', 'EVALUATE', 'Which statements about decompositions are correct? Select all that apply.',
    ['A lossless, dependency-preserving decomposition into 3NF always exists', 'A lossless decomposition into BCNF always exists', 'A dependency-preserving decomposition into BCNF always exists', 'Joining the parts of a lossy decomposition produces spurious tuples'],
    [0, 1, 3], '3NF can always be reached without losing the join or any dependency. BCNF can always be reached losslessly but may sacrifice dependency preservation. A lossy join adds spurious tuples.', ['bcnf', 'decomposition']),

  // --- Transactions and ACID
  single(ACID, 'EASY', 'REMEMBER', 'Which ACID property guarantees that the changes of a committed transaction survive a system crash?',
    ['Atomicity', 'Consistency', 'Isolation', 'Durability'],
    3, 'Durability is provided by the recovery manager, which redoes committed work from the log after a crash.', ['transactions', 'acid']),
  tf(ACID, 'MEDIUM', 'UNDERSTAND', 'Two read operations on the same data item by different transactions conflict with each other.',
    false, 'Operations conflict only if they are from different transactions, touch the same item and at least one is a write.', ['transactions', 'serializability']),
  single(ACID, 'HARD', 'ANALYZE', 'Consider the schedule R1(A), R2(A), W1(A), W2(A). Which statement is correct?',
    ['It is conflict serializable and equivalent to T1 followed by T2', 'It is conflict serializable and equivalent to T2 followed by T1', 'It is not conflict serializable because the precedence graph contains a cycle', 'It is a serial schedule'],
    2, 'R1(A) before W2(A) gives T1 -> T2 and R2(A) before W1(A) gives T2 -> T1. The cycle means the schedule is not conflict serializable (a lost update).', ['transactions', 'serializability']),

  // --- Isolation Levels and Concurrency
  single(ISO, 'MEDIUM', 'UNDERSTAND', 'Which is the lowest SQL isolation level that prevents non-repeatable reads?',
    ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'],
    2, 'READ COMMITTED prevents only dirty reads. REPEATABLE READ also prevents non-repeatable reads; phantoms remain possible until SERIALIZABLE.', ['isolation']),
  single(ISO, 'MEDIUM', 'APPLY', 'T1 runs SELECT COUNT(*) FROM orders WHERE amount > 1000 twice. Between the two statements T2 inserts a qualifying row and commits, and the second count is higher. Which anomaly is this?',
    ['Phantom read', 'Dirty read', 'Lost update', 'Non-repeatable read'],
    0, 'The set of rows matching the predicate changed because of an insert: that is a phantom. A non-repeatable read is a change to an existing row.', ['isolation', 'anomalies']),
  single(ISO, 'HARD', 'EVALUATE', 'Which statement about two-phase locking (2PL) is correct?',
    ['Basic 2PL prevents deadlock', 'Basic 2PL guarantees conflict serializability but can still deadlock', 'Strict 2PL releases exclusive locks before the transaction commits', '2PL lets a transaction acquire a new lock after it has released one'],
    1, '2PL guarantees conflict serializability. It does not prevent deadlock, strict 2PL holds exclusive locks until commit, and no lock may be acquired in the shrinking phase.', ['locking', '2pl']),
  subj(ISO, 'MEDIUM', 'UNDERSTAND', 'Explain the difference between a non-repeatable read and a phantom read, and name the lowest SQL isolation level that prevents each of them.',
    'Model answer. Non-repeatable read: a transaction reads the same existing row twice and sees different values because another transaction updated it and committed in between; prevented from REPEATABLE READ upward. Phantom read: a transaction repeats a range query and the set of rows changes because another transaction inserted or deleted matching rows; prevented only at SERIALIZABLE. Award 2 marks for each definition and 1 for the two levels.',
    {
      good: 'A non-repeatable read happens when T1 reads a row, T2 updates that same row and commits, and T1 reads it again and gets a different value. A phantom read is about the set of rows: T1 runs a range query twice and new rows appear (or disappear) because T2 inserted or deleted rows that match the condition. REPEATABLE READ is the lowest level that prevents non-repeatable reads and SERIALIZABLE is the lowest that prevents phantoms.',
      partial: 'Non-repeatable read means reading the same row twice gives different values because another transaction changed it. Phantom read is when new rows appear. Both are prevented by SERIALIZABLE.',
      weak: 'Both are problems where a transaction reads wrong data from another transaction that has not committed yet. They are prevented by using locks.',
    }, ['isolation', 'anomalies']),

  // --- B+ Tree Indexing
  single(BTREE, 'EASY', 'REMEMBER', 'In a B+ tree, pointers to the actual records are stored:',
    ['in every node', 'only in the root', 'only in the leaf nodes', 'only in the internal nodes'],
    2, 'Internal nodes hold only keys and child pointers; all record pointers are in the linked leaf level.', ['indexing', 'b-plus-tree']),
  fill(BTREE, 'HARD', 'APPLY', 'A B+ tree internal node must fit in a 4096-byte block. Keys are 8 bytes and child pointers are 8 bytes. The maximum number of child pointers in an internal node is ______.',
    ['256'], ['255', '512', '257'],
    'With p pointers and p - 1 keys: 8p + 8(p - 1) <= 4096, so 16p <= 4104 and p = 256.', ['indexing', 'b-plus-tree']),
  single(BTREE, 'EXPERT', 'ANALYZE', 'A B+ tree has leaves holding 255 entries each and internal nodes with 256 children each. With every node full, how many levels (including the leaf level) does the index need for 1,000,000 records?',
    ['2', '3', '4', '5'],
    1, 'ceil(1,000,000 / 255) = 3,922 leaves; ceil(3,922 / 256) = 16 nodes above them; one root above those. That is 3 levels.', ['indexing', 'b-plus-tree']),
];
