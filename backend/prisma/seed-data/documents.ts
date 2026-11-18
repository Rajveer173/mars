// Institute-wide policy documents. The seed does not insert these; it exports
// them for the knowledge-base indexer, which stores them with a null courseId so
// every signed-in user can retrieve them.

export const INSTITUTE_DOCUMENTS: { title: string; text: string }[] = [
  {
    title: 'Examination Regulations 2026-27',
    text: `# Examination Regulations 2026-27

These regulations apply to every online test conducted by Meridian Institute of Technology on the examination platform during the academic year 2026-27. They are issued by the Examination Cell under the authority of the Dean of Academics.

## 1. Types of test and number of attempts

| Test | Attempts allowed | Counts towards the grade |
|---|---|---|
| Quiz | 1 | Yes |
| Midterm examination | 1 | Yes |
| End-semester examination | 1 | Yes |
| Practice or mock test | Up to 3 | No; the best score is shown for self-assessment |

A student passes a test by scoring at least **40 percent** of its total marks.

## 2. Marking and negative marking

- Each question shows its marks. A correct answer earns the full marks.
- For every **wrong answer to an objective question** (single choice, multiple choice, true or false, fill in the blank), **0.25 marks are deducted**.
- An unanswered question earns zero and carries no penalty.
- A multiple-choice question is correct only when exactly the right set of options is selected; there is no partial credit.
- Descriptive answers are marked by the course teacher and carry no negative marking.
- A total score cannot fall below zero.

## 3. Test window, duration and grace period

- A test can be started only between its opening and closing times. The timer starts when the student presses Start and cannot be paused.
- The attempt is submitted automatically when the duration ends or the window closes, whichever comes first.
- For midterm and end-semester examinations there is a **grace period of 10 minutes**: a student may start up to 10 minutes after the scheduled opening time and still receives the full duration. Entry after the grace period is not permitted.
- Quizzes stay open for 24 hours and have no grace period.
- After a power or network failure the student may sign in again and resume; the timer keeps running. The failure must be reported to the Examination Cell within 24 hours.

## 4. Attendance requirement

A student needs at least **75 percent attendance** in a course to sit its end-semester examination. Attendance between 65 and 74 percent may be condoned by the Dean of Academics on documented medical grounds. Below 65 percent the student is detained and must repeat the course.

## 5. Malpractice

Proctored tests record tab switches, loss of window focus, leaving full-screen mode, and copy or paste actions, and compute a suspicion score. Sessions scoring **50 or more** are reviewed by the Examination Cell. After review the penalties are:

1. **Level 1** (minor, first instance): written warning.
2. **Level 2** (use of unauthorised material or repeated violations): the test is cancelled and scored zero.
3. **Level 3** (impersonation or organised copying): all tests of the semester are cancelled and the case goes to the Disciplinary Committee.

The student is heard within 5 working days before any penalty is imposed.

## 6. Re-evaluation and answer-key objections

- Objections to the answer key of objective questions must be raised within **3 days** of the result.
- Re-evaluation is available for descriptive answers only. Apply within **7 days** of the result, with a fee of Rs 500 per course.
- The re-evaluated mark is final, whether higher or lower. The fee is refunded if the mark rises by 10 percent of the maximum or more.

## 7. Make-up tests

A student who misses a midterm or end-semester examination for a medical or family emergency may apply within 3 working days, with documents. One make-up is allowed per course per semester. Quizzes have no make-up; the lowest quiz score of the semester is dropped instead.`,
  },
  {
    title: 'Grading and Academic Integrity Policy',
    text: `# Grading and Academic Integrity Policy

This policy explains how marks become grades at Meridian Institute of Technology and what the institute expects of students when they submit work for assessment.

## 1. Assessment components

| Component | Weight in the course total |
|---|---|
| Quizzes | 15 percent |
| Assignments | 15 percent |
| Midterm examination | 20 percent |
| End-semester examination | 50 percent |

## 2. Grade bands

The course total, out of 100, is converted to a letter grade on a 10-point scale.

| Course total | Grade | Grade points |
|---|---|---|
| 90 to 100 | O (Outstanding) | 10 |
| 80 to 89 | A+ | 9 |
| 70 to 79 | A | 8 |
| 60 to 69 | B+ | 7 |
| 50 to 59 | B | 6 |
| 40 to 49 | C | 5 |
| Below 40 | F (Fail) | 0 |

A student with an F grade must clear the course in a supplementary examination. The highest grade that can be awarded after a supplementary examination is B.

## 3. How SGPA and CGPA are computed

For each course, multiply its credits by the grade points earned. The **SGPA** of a semester is the sum of these products divided by the total credits registered in that semester. The **CGPA** is the same calculation taken over every course in all semesters completed so far. Both are rounded to two decimal places.

Example: three courses of 4, 4 and 3 credits with grades A+, B+ and O give (4 x 9 + 4 x 7 + 3 x 10) / 11 = 94 / 11 = 8.55.

When a percentage is required, the institute uses: percentage = (CGPA - 0.75) x 10. A CGPA of 8.55 corresponds to 78.0 percent.

## 4. Plagiarism

Every assignment is checked for similarity against other submissions and published sources.

| Similarity | Outcome |
|---|---|
| Up to 15 percent | Accepted |
| 16 to 40 percent | Must be resubmitted within 3 days; marks are capped at 75 percent of the maximum |
| Above 40 percent, or copied from another student | Zero for the assignment for everyone involved, and the case is recorded |

A second recorded case in the same course results in an F grade for that course and referral to the Disciplinary Committee.

Students may discuss ideas with each other, but the submitted text or code must be their own. Sharing your solution is treated in the same way as copying one. Generative AI tools may be used only where the assignment brief allows it, and their use must be acknowledged; unacknowledged AI-generated work is treated as plagiarism.

## 5. Late submission

- The platform closes an assignment at its deadline. Late work is accepted only through the course teacher, who may reopen the submission.
- **10 percent of the maximum marks is deducted for each calendar day** of delay, for up to 3 days.
- Work that is more than 3 days late is not accepted and is scored zero.
- An extension without penalty may be granted on medical grounds when it is requested before the deadline.

## 6. Appeals

A student who believes a grade was computed incorrectly may write to the Head of Department within 7 days of the grade being published. The department replies within 10 working days. Re-evaluation of examination answers follows the Examination Regulations.`,
  },
];
