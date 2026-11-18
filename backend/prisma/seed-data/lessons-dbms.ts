import type { SeedModule } from './types.js';

export const DBMS_MODULES: SeedModule[] = [
  {
    title: 'Relational Model and SQL',
    description: 'How data is modelled as relations, how keys and constraints keep it correct, and how SQL queries it.',
    lessons: [
      {
        title: 'The Relational Model and Keys',
        topic: 'Relational Model and Keys',
        durationMin: 35,
        content: `# The Relational Model and Keys

The relational model, proposed by E. F. Codd in 1970, represents data as **relations** (tables). Each relation has a fixed set of **attributes** (columns) and a set of **tuples** (rows). Because a relation is a set, the order of rows does not matter and no two rows may be identical.

## Core terms

- **Domain**: the set of legal values for an attribute, for example the integers 1 to 8 for a semester number.
- **Degree**: the number of attributes in a relation.
- **Cardinality**: the number of tuples currently in the relation.
- **Schema**: the structure, written as Student(roll_no, name, dept_code, email).
- **Instance**: the rows stored at a particular moment.

## Types of keys

| Key | Definition |
|---|---|
| Super key | Any set of attributes that uniquely identifies a tuple |
| Candidate key | A minimal super key: removing any attribute breaks uniqueness |
| Primary key | The candidate key chosen by the designer; it cannot be NULL |
| Alternate key | A candidate key that was not chosen as the primary key |
| Foreign key | Attributes that refer to the primary key of another (or the same) relation |

### Worked example

Consider Student(roll_no, email, name, dept_code) where roll_no and email are each unique.

- Super keys include {roll_no}, {email}, {roll_no, name} and {roll_no, email, name, dept_code}.
- Candidate keys are {roll_no} and {email}: each is unique on its own and has no removable attribute.
- If roll_no is chosen as the primary key, email becomes an alternate key.
- dept_code is a foreign key that references Department(dept_code).

## Integrity constraints

1. **Domain constraint**: every value must come from the attribute's domain.
2. **Entity integrity**: no part of a primary key may be NULL, otherwise the row could not be identified.
3. **Referential integrity**: a foreign key value must either match an existing primary key value in the referenced relation or be NULL.

\`\`\`sql
CREATE TABLE Student (
  roll_no   INT PRIMARY KEY,
  email     VARCHAR(120) NOT NULL UNIQUE,
  name      VARCHAR(80) NOT NULL,
  dept_code CHAR(3),
  FOREIGN KEY (dept_code) REFERENCES Department(dept_code)
    ON DELETE SET NULL
);
\`\`\`

When a referenced Department row is deleted, the action clause decides the outcome: RESTRICT (or NO ACTION) rejects the delete, CASCADE deletes the dependent students, and SET NULL keeps the students but clears their dept_code.

## Common mistakes

- Saying every super key is a candidate key. Only **minimal** super keys are candidate keys.
- Believing a relation can have several primary keys. It has exactly one, although that key may be **composite** (made of several attributes).
- Forgetting that a foreign key may be NULL unless it is declared NOT NULL, and that it may reference its own table, as in Employee(manager_id) referencing Employee(emp_id).
- Counting super keys wrongly. If a relation with n attributes has one single-attribute candidate key and no other candidate key, it has 2 to the power (n - 1) super keys, because each remaining attribute may be present or absent.`,
      },
      {
        title: 'SQL Joins and Aggregation',
        topic: 'SQL Joins and Aggregation',
        durationMin: 45,
        content: `# SQL Joins and Aggregation

A join combines rows from two tables using a condition; aggregation collapses many rows into summary values. Most exam queries are a combination of the two, so it pays to know exactly which rows survive each step.

## Sample data

Student(roll_no, name, dept_code): (1, Asha, CSE), (2, Ravi, CSE), (3, Meena, IT), (4, Kiran, ECE)

Enrolment(roll_no, course_code, marks): (1, CS301, 82), (1, CS302, 74), (2, CS301, 65), (3, CS301, 91)

## Join types

| Join | Rows returned for Student joined with Enrolment on roll_no |
|---|---|
| INNER JOIN | Only matching pairs: 4 rows (Kiran has no enrolment and disappears) |
| LEFT JOIN | All students: 5 rows (Kiran appears once with NULL course_code and marks) |
| RIGHT JOIN | All enrolments, plus NULLs for enrolments with no student |
| FULL OUTER JOIN | Union of left and right results |
| CROSS JOIN | Every combination: 4 x 4 = 16 rows |

## Aggregation with GROUP BY and HAVING

\`\`\`sql
SELECT s.dept_code, COUNT(*) AS enrolments, AVG(e.marks) AS avg_marks
FROM Student s
JOIN Enrolment e ON e.roll_no = s.roll_no
WHERE e.marks >= 40
GROUP BY s.dept_code
HAVING AVG(e.marks) >= 80;
\`\`\`

### Worked example

1. FROM and JOIN produce 4 rows: CSE has marks 82, 74 and 65; IT has 91.
2. WHERE keeps all 4 rows because every mark is at least 40.
3. GROUP BY forms two groups: CSE (3 rows, average 221 / 3 = 73.67) and IT (1 row, average 91).
4. HAVING removes CSE because 73.67 is below 80.
5. The result is a single row: IT, 1, 91.

The logical order of evaluation is FROM, JOIN, WHERE, GROUP BY, HAVING, SELECT, ORDER BY, and finally LIMIT. That order explains two rules: WHERE cannot contain an aggregate function (groups do not exist yet), and a column alias defined in SELECT cannot be used in WHERE.

## NULL handling

- COUNT(*) counts rows; COUNT(column) counts only non-NULL values. With a LEFT JOIN, COUNT(e.course_code) reports 0 for Kiran but COUNT(*) reports 1.
- SUM, AVG, MIN and MAX ignore NULL values.
- A comparison with NULL using = is never true; write IS NULL or IS NOT NULL.

## Common mistakes

- Selecting a column that is neither inside an aggregate nor listed in GROUP BY. Standard SQL rejects this.
- Putting a filter on the right-hand table in WHERE after a LEFT JOIN. The condition discards the NULL-extended rows, so the query silently behaves like an INNER JOIN. Move the condition into the ON clause to keep unmatched rows.
- Using WHERE where HAVING is needed. WHERE filters rows before grouping; HAVING filters groups after aggregation.
- Forgetting the join condition, which produces a Cartesian product and wildly inflated counts.`,
      },
      {
        title: 'ER Modelling and Mapping to Tables',
        topic: 'ER Modelling',
        durationMin: 40,
        content: `# ER Modelling and Mapping to Tables

An Entity-Relationship (ER) diagram is a conceptual design: it captures what the organisation needs to store before any tables are created. The diagram is then converted to a relational schema by a fixed set of rules.

## Building blocks

- **Entity set**: a collection of similar objects, such as Student or Course. A **strong** entity has its own key.
- **Weak entity**: cannot be identified by its own attributes. It depends on an owner entity through an **identifying relationship** and has only a **partial key** (discriminator).
- **Attributes**: simple, composite (address made of street, city, pin), multivalued (several phone numbers) or derived (age computed from date of birth).
- **Relationship set**: an association between entities, with a **cardinality ratio** of 1:1, 1:N or M:N.
- **Participation**: total (every entity must take part, drawn with a double line) or partial.

## Mapping rules

| ER construct | Relational result |
|---|---|
| Strong entity | One table; the key becomes the primary key |
| Weak entity | One table; primary key = owner's key + partial key |
| 1:N relationship | Foreign key on the N side; no new table |
| 1:1 relationship | Foreign key on either side (prefer the side with total participation), declared UNIQUE |
| M:N relationship | A new table whose primary key combines both foreign keys; relationship attributes go here |
| Multivalued attribute | A new table: owner's key + the attribute value |
| Composite attribute | Store only the component attributes |
| Derived attribute | Not stored; computed when needed |

## Worked example

Requirements: every student belongs to exactly one department; a student may have several phone numbers; students enrol in many courses and each course has many students, with a grade per enrolment; each course is offered in numbered sections, and a section number is only meaningful within its course.

Applying the rules:

\`\`\`text
Department(dept_code PK, name)
Student(roll_no PK, name, dept_code FK NOT NULL)
Student_Phone(roll_no FK, phone)            PK (roll_no, phone)
Course(course_code PK, title, credits)
Section(course_code FK, section_no, room)   PK (course_code, section_no)
Enrols(roll_no FK, course_code FK, grade)   PK (roll_no, course_code)
\`\`\`

The design needs **six tables**. "Belongs to" is 1:N, so it becomes the foreign key dept_code in Student; NOT NULL enforces total participation. Section is a weak entity owned by Course. Enrols is M:N, so it gets its own table and carries the grade attribute.

## Exam tips

- Count tables methodically: strong entities, then weak entities, then M:N relationships, then multivalued attributes. 1:N and 1:1 relationships normally add no table.
- An attribute of a 1:N relationship moves to the N side together with the foreign key.
- A weak entity always has total participation in its identifying relationship.
- Do not store derived attributes; they create update anomalies when the source value changes.
- A ternary relationship cannot, in general, be replaced by three binary relationships without losing information.`,
      },
    ],
  },
  {
    title: 'Schema Design and Normalisation',
    description: 'Functional dependencies, the normal forms up to BCNF, and how to decompose a schema without losing information.',
    lessons: [
      {
        title: 'Functional Dependencies and Attribute Closure',
        topic: 'Functional Dependencies',
        durationMin: 40,
        content: `# Functional Dependencies and Attribute Closure

A **functional dependency** (FD) X -> Y holds on a relation if any two tuples that agree on the attributes X also agree on the attributes Y. In words: X determines Y. FDs are statements about the meaning of the data, not about one particular instance; an instance can only disprove an FD, never prove it.

An FD is **trivial** when Y is a subset of X, for example {roll_no, name} -> name.

## Armstrong's axioms

These three rules are sound and complete: every FD implied by a set F can be derived with them.

1. **Reflexivity**: if Y is a subset of X, then X -> Y.
2. **Augmentation**: if X -> Y, then XZ -> YZ.
3. **Transitivity**: if X -> Y and Y -> Z, then X -> Z.

Useful derived rules are **union** (X -> Y and X -> Z give X -> YZ), **decomposition** (X -> YZ gives X -> Y and X -> Z) and **pseudo-transitivity** (X -> Y and WY -> Z give WX -> Z).

## Attribute closure

The closure of X, written X+, is the set of all attributes determined by X. Algorithm: start with result = X; repeatedly, for each FD A -> B with A inside result, add B to result; stop when nothing changes.

X is a **super key** if X+ contains every attribute, and a **candidate key** if, in addition, no proper subset of X is a super key.

### Worked example

R(A, B, C, D, E) with F = { A -> BC, CD -> E, B -> D, E -> A }.

- A+ : start {A}; A -> BC gives {A, B, C}; B -> D gives {A, B, C, D}; CD -> E gives all five attributes. So A is a candidate key.
- E+ : E -> A gives {A, E}, and A already determines everything. E is a candidate key.
- CD+ : CD -> E gives {C, D, E}; E -> A adds A; A -> BC adds B. CD is a key, and neither C+ = {C} nor D+ = {D} is, so CD is a candidate key.
- BC+ : B -> D gives {B, C, D}; CD -> E adds E; E -> A adds A. BC is a candidate key because B+ = {B, D} and C+ = {C}.

The candidate keys are **A, E, CD and BC**. Every attribute belongs to some candidate key, so every attribute is **prime**.

## Minimal (canonical) cover

A minimal cover is an equivalent set of FDs with single attributes on the right, no extraneous attribute on the left and no redundant FD. For F = { A -> BC, B -> C, A -> B, AB -> C }:

- A -> C is redundant because A -> B and B -> C imply it.
- In AB -> C, A is extraneous because B -> C already holds.

The minimal cover is { A -> B, B -> C }.

## Exam tips

- An attribute that never appears on the right-hand side of any FD must be part of every candidate key.
- To test whether F implies X -> Y, compute X+ under F and check that Y is inside it.
- Do not "cancel" attributes: AB -> C does not imply A -> C or B -> C.`,
      },
      {
        title: 'Normal Forms: 1NF, 2NF and 3NF',
        topic: 'Normalisation',
        durationMin: 45,
        content: `# Normal Forms: 1NF, 2NF and 3NF

Normalisation removes redundancy by splitting a relation so that each fact is stored exactly once. Redundancy causes three **anomalies**:

- **Update anomaly**: a fact stored in many rows must be changed in all of them.
- **Insertion anomaly**: a fact cannot be recorded until some unrelated fact exists.
- **Deletion anomaly**: deleting one fact unintentionally removes another.

## Definitions

| Normal form | Requirement |
|---|---|
| 1NF | Every attribute holds a single atomic value; no repeating groups |
| 2NF | 1NF, and no non-prime attribute depends on a proper subset of a candidate key (no partial dependency) |
| 3NF | 2NF, and no non-prime attribute depends transitively on a key |

A **prime attribute** is one that belongs to some candidate key. The formal 3NF test: for every non-trivial FD X -> A, either X is a super key or A is a prime attribute.

## Worked decomposition

Start with one wide relation whose key is (roll_no, course_code):

\`\`\`text
Result(roll_no, student_name, dept_code, dept_hod, course_code, course_title, grade)
\`\`\`

Functional dependencies:

- roll_no -> student_name, dept_code
- dept_code -> dept_hod
- course_code -> course_title
- roll_no, course_code -> grade

**Step 1: 1NF.** All values are atomic, so the relation is already in 1NF. (If a student row held a list of phone numbers, we would first move them to a separate table.)

**Step 2: 2NF.** student_name and dept_code depend only on roll_no, and course_title depends only on course_code. These are partial dependencies on part of the key, so we split:

\`\`\`text
Student(roll_no, student_name, dept_code, dept_hod)
Course(course_code, course_title)
Result(roll_no, course_code, grade)
\`\`\`

**Step 3: 3NF.** In Student, roll_no -> dept_code and dept_code -> dept_hod, so dept_hod depends on the key only transitively. Split again:

\`\`\`text
Student(roll_no, student_name, dept_code)
Department(dept_code, dept_hod)
Course(course_code, course_title)
Result(roll_no, course_code, grade)
\`\`\`

The final design has four relations. Changing a head of department now updates one row, a new course can be added before anyone enrols, and deleting the last result of a student no longer deletes the student.

## Exam tips

- A relation whose candidate keys are all single attributes is automatically in 2NF, because a partial dependency needs a composite key.
- A relation with only two attributes is always in BCNF, and therefore in 3NF.
- Find **all** candidate keys before testing a normal form. A dependency on a prime attribute does not violate 3NF.
- Normalisation is about dependencies, not about the number of columns. A table with fifty columns can be in 3NF.
- Higher normal forms reduce redundancy but need more joins; reporting databases are sometimes deliberately denormalised for read speed.`,
      },
      {
        title: 'BCNF and Lossless Decomposition',
        topic: 'BCNF and Lossless Decomposition',
        durationMin: 40,
        content: `# BCNF and Lossless Decomposition

Boyce-Codd Normal Form (BCNF) is a stricter version of 3NF. A relation is in **BCNF** if, for every non-trivial functional dependency X -> Y, X is a super key. 3NF makes an exception when Y is a prime attribute; BCNF makes none.

## A relation in 3NF but not in BCNF

Teaching(student, course, instructor) with the rules:

- student, course -> instructor (a student has one instructor per course)
- instructor -> course (each instructor teaches only one course)

Candidate keys are (student, course) and (student, instructor), so all three attributes are prime and the relation is in 3NF. But instructor -> course has a left side that is not a super key, so the relation is **not in BCNF**. The redundancy is real: the pair (instructor, course) is repeated for every student of that instructor.

### BCNF decomposition

Split on the violating FD X -> Y into (X union Y) and (R minus Y):

\`\`\`text
R1(instructor, course)      key: instructor
R2(student, instructor)     key: (student, instructor)
\`\`\`

Both relations are in BCNF. However, the dependency student, course -> instructor can no longer be checked inside a single table: the decomposition is **not dependency preserving**.

## Two properties of a good decomposition

1. **Lossless join**: joining the parts gives back exactly the original relation, with no spurious tuples.
2. **Dependency preservation**: every FD can be enforced by looking at one relation only.

### Lossless-join test for two relations

A decomposition of R into R1 and R2 is lossless if the common attributes form a super key of at least one of them:

- (R1 intersect R2) -> R1, or
- (R1 intersect R2) -> R2.

In the example the common attribute is instructor, and instructor -> course makes it a key of R1, so the join is lossless.

### A lossy example

R(A, B, C) with the single FD A -> B.

- Splitting into (A, B) and (B, C): the common attribute B determines neither A nor C, so the decomposition is **lossy** and the join produces spurious tuples.
- Splitting into (A, B) and (A, C): the common attribute A determines B, so it is lossless.

## What can always be achieved

| Target | Lossless | Dependency preserving |
|---|---|---|
| 3NF | Always possible | Always possible |
| BCNF | Always possible | Not always possible |

## Common mistakes

- Assuming a lossy decomposition loses rows. It actually produces **extra** (spurious) rows; what is lost is information about which rows were genuine.
- Checking the BCNF condition only for the FDs as written. In a decomposed relation you must consider the FDs that hold on its attributes, which requires attribute closures.
- Believing BCNF is always better. When BCNF would lose a dependency, designers often stop at 3NF and accept a little redundancy.
- Forgetting that every BCNF relation is also in 3NF, but not the reverse.`,
      },
    ],
  },
  {
    title: 'Transactions and Storage',
    description: 'How a DBMS keeps data correct under concurrency and failures, and how B+ tree indexes make lookups fast.',
    lessons: [
      {
        title: 'Transactions and the ACID Properties',
        topic: 'Transactions and ACID',
        durationMin: 40,
        content: `# Transactions and the ACID Properties

A **transaction** is a sequence of operations that the database treats as one logical unit of work. The standard example is a fund transfer: debit 500 from account A and credit 500 to account B. Either both updates happen or neither does.

## ACID

| Property | Meaning | Ensured by |
|---|---|---|
| Atomicity | All operations take effect, or none do | Recovery manager (undo using the log) |
| Consistency | A transaction takes the database from one valid state to another | Application logic plus integrity constraints |
| Isolation | Concurrent transactions do not interfere; the result equals some serial order | Concurrency control (locks or MVCC) |
| Durability | Once committed, changes survive crashes | Recovery manager (redo using the log) |

## Transaction states

Active -> Partially committed (last statement executed) -> Committed. From Active or Partially committed a transaction can move to Failed and then Aborted, after which its changes are rolled back.

## Write-ahead logging

The log record describing a change must reach stable storage **before** the changed data page does. After a crash, recovery **redoes** the updates of committed transactions and **undoes** the updates of transactions that had not committed.

## Schedules and serializability

A **schedule** is an interleaving of operations from several transactions. A **serial** schedule runs them one after another. A schedule is **conflict serializable** if it can be turned into a serial schedule by swapping adjacent non-conflicting operations. Two operations **conflict** if they belong to different transactions, access the same item, and at least one of them is a write.

**Test**: build a precedence graph with one node per transaction and an edge Ti -> Tj whenever an operation of Ti conflicts with a later operation of Tj. The schedule is conflict serializable exactly when the graph has no cycle.

### Worked example

\`\`\`text
T1: R(A)         W(A)
T2:       R(A)         W(A)
\`\`\`

The order is R1(A), R2(A), W1(A), W2(A).

- R1(A) before W2(A): edge T1 -> T2.
- R2(A) before W1(A): edge T2 -> T1.
- W1(A) before W2(A): edge T1 -> T2.

The graph has the cycle T1 -> T2 -> T1, so the schedule is **not** conflict serializable. This is the **lost update** problem: both transactions read the old value, and T2's write overwrites T1's.

## Exam tips

- Consistency is the only ACID property that is mainly the programmer's responsibility; the DBMS can only enforce declared constraints.
- Every conflict-serializable schedule is view serializable, but not the reverse.
- A read followed by a read never conflicts, even on the same item.
- A **recoverable** schedule requires that a transaction commits only after every transaction whose data it read has committed. A **cascadeless** schedule goes further and allows reads of committed data only.
- Durability does not mean data is flushed to the data files at commit; it is enough that the log is on stable storage.`,
      },
      {
        title: 'Isolation Levels and Concurrency Control',
        topic: 'Isolation Levels and Concurrency',
        durationMin: 45,
        content: `# Isolation Levels and Concurrency Control

Running transactions strictly one at a time is safe but slow. Databases therefore let transactions overlap and offer **isolation levels** that trade correctness guarantees for throughput.

## The classic anomalies

- **Dirty read**: T2 reads a value written by T1 before T1 commits. If T1 rolls back, T2 has used data that never existed.
- **Non-repeatable read**: T1 reads a row, T2 updates it and commits, and T1 reads the same row again and sees a different value.
- **Phantom read**: T1 runs a range query twice and the second run returns extra (or fewer) rows because T2 inserted or deleted matching rows in between.
- **Lost update**: two transactions read the same value and both write back; one update disappears.

## SQL isolation levels

| Level | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ UNCOMMITTED | Possible | Possible | Possible |
| READ COMMITTED | Prevented | Possible | Possible |
| REPEATABLE READ | Prevented | Prevented | Possible |
| SERIALIZABLE | Prevented | Prevented | Prevented |

Defaults differ by product: PostgreSQL, Oracle and SQL Server default to READ COMMITTED, while MySQL InnoDB defaults to REPEATABLE READ.

### Worked example: non-repeatable read

\`\`\`text
T1: SELECT balance FROM account WHERE id = 7;      -- returns 1000
T2: UPDATE account SET balance = 400 WHERE id = 7; COMMIT;
T1: SELECT balance FROM account WHERE id = 7;      -- returns 400
\`\`\`

At READ COMMITTED this is allowed, because T1 only ever reads committed data. At REPEATABLE READ the second read must again return 1000.

## Lock-based control

- A **shared (S) lock** is needed to read and an **exclusive (X) lock** to write. S is compatible with S; X is compatible with nothing.
- **Two-phase locking (2PL)**: a transaction has a growing phase in which it only acquires locks, followed by a shrinking phase in which it only releases them. 2PL guarantees conflict serializability.
- **Strict 2PL** holds all exclusive locks until commit or abort. This prevents dirty reads and therefore cascading rollbacks.
- 2PL does **not** prevent deadlock. Databases detect deadlocks with a wait-for graph and abort a victim, or use timeouts.

## Multiversion concurrency control (MVCC)

Instead of blocking, the database keeps several versions of a row. A reader sees the snapshot that was current when its transaction (or statement) began, so **readers do not block writers and writers do not block readers**. Writers still conflict with other writers on the same row.

## Common mistakes

- Thinking REPEATABLE READ is fully safe. By the SQL standard it still allows phantoms; only SERIALIZABLE removes all three anomalies.
- Confusing a non-repeatable read (an existing row changes) with a phantom (the set of rows changes).
- Assuming a higher level is always better. Higher isolation means more locking or more aborted transactions, so throughput falls.
- Saying 2PL avoids deadlock. It ensures serializability; deadlock handling is a separate mechanism.`,
      },
      {
        title: 'Indexing with B+ Trees',
        topic: 'B+ Tree Indexing',
        durationMin: 45,
        content: `# Indexing with B+ Trees

Without an index, finding one row means scanning the whole table. An **index** is an auxiliary structure that maps search-key values to row locations. Almost every relational database uses the **B+ tree** as its default index.

## Structure of a B+ tree

- It is **balanced**: every path from the root to a leaf has the same length.
- **Internal nodes** store only keys and child pointers; they act as a road map.
- **Leaf nodes** store every key together with a pointer to the record (or the record itself), and each leaf is linked to the next leaf.
- With order p, an internal node has at most p children and p - 1 keys, and (except the root) at least ceil(p / 2) children.

Because the leaves are linked in key order, a range query such as marks BETWEEN 60 AND 80 finds the first qualifying leaf and then simply follows the links.

## B tree versus B+ tree

| Feature | B tree | B+ tree |
|---|---|---|
| Record pointers | In every node | Only in leaves |
| Fan-out of internal nodes | Lower | Higher, so the tree is shorter |
| Range scan | Needs tree traversal | Sequential over linked leaves |
| Search cost | May stop early at an internal node | Always goes to a leaf |

## Worked example: order and height

Block size 4096 bytes, key 8 bytes, pointer 8 bytes.

**Internal node** with p children: p pointers and p - 1 keys must fit.

\`\`\`text
8p + 8(p - 1) <= 4096   ->   16p <= 4104   ->   p = 256
\`\`\`

**Leaf node** with n entries (key + record pointer) plus one next-leaf pointer:

\`\`\`text
16n + 8 <= 4096   ->   n = 255
\`\`\`

For 1,000,000 records with full nodes:

- Leaves needed: ceil(1,000,000 / 255) = 3,922.
- Level above: ceil(3,922 / 256) = 16 nodes.
- Root: 1 node with 16 children.

The tree has **3 levels**, so a lookup reads 3 index blocks plus 1 block for the record. A full scan would read thousands of blocks.

## Insertion and splitting

When a leaf overflows it splits in two and the smallest key of the new right leaf is **copied** up to the parent. When an internal node overflows, its middle key is **moved** up. The tree grows in height only when the root splits, which is why it stays balanced.

## Kinds of index

- **Clustered (primary) index**: the table rows are stored in index order; only one per table.
- **Secondary index**: a separate structure pointing to rows; many are allowed, and it must be dense.
- **Composite index** on (a, b): usable for conditions on a, or on a and b, but not on b alone (the leftmost-prefix rule).

## Common mistakes

- Indexing every column. Each index must be updated on every INSERT, UPDATE and DELETE.
- Expecting an index to help with LIKE '%sharma'. A leading wildcard prevents an ordered search.
- Assuming a hash index supports range queries; it supports equality only.`,
      },
    ],
  },
];
