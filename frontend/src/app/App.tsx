import { Component, lazy, Suspense, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Landing } from '@/pages/Landing';
import { SignIn } from '@/pages/auth/SignIn';
import { buttonClass, Spinner } from '@/ui/core';
import { Only, Shell } from './Shell';
import { ROLE_HOME, useAuth } from '@/lib/auth';

const Ask = lazy(() => import('@/pages/ask/Ask').then(m => ({ default: m.Ask })));
const StudentHome = lazy(() => import('@/pages/student/Home').then(m => ({ default: m.StudentHome })));
const StudentTests = lazy(() => import('@/pages/student/Tests').then(m => ({ default: m.StudentTests })));
const Exam = lazy(() => import('@/pages/student/Exam').then(m => ({ default: m.Exam })));
const Progress = lazy(() => import('@/pages/student/Progress').then(m => ({ default: m.Progress })));
const StaffOverview = lazy(() => import('@/pages/staff/Overview').then(m => ({ default: m.StaffOverview })));
const StaffTests = lazy(() => import('@/pages/tests/StaffTests').then(m => ({ default: m.StaffTests })));
const TestDetail = lazy(() => import('@/pages/tests/TestDetail').then(m => ({ default: m.TestDetail })));
const TestEditor = lazy(() => import('@/pages/tests/TestEditor').then(m => ({ default: m.TestEditor })));
const Results = lazy(() => import('@/pages/results/Results').then(m => ({ default: m.Results })));
const ResultDetail = lazy(() => import('@/pages/results/ResultDetail').then(m => ({ default: m.ResultDetail })));
const Courses = lazy(() => import('@/pages/courses/Courses').then(m => ({ default: m.Courses })));
const CourseDetail = lazy(() => import('@/pages/courses/CourseDetail').then(m => ({ default: m.CourseDetail })));
const Lesson = lazy(() => import('@/pages/courses/Lesson').then(m => ({ default: m.Lesson })));
const QuestionStudio = lazy(() => import('@/pages/questions/Studio').then(m => ({ default: m.QuestionStudio })));
const Draft = lazy(() => import('@/pages/questions/Draft').then(m => ({ default: m.Draft })));
const Knowledge = lazy(() => import('@/pages/knowledge/Knowledge').then(m => ({ default: m.Knowledge })));
const Runs = lazy(() => import('@/pages/runs/Runs').then(m => ({ default: m.Runs })));
const People = lazy(() => import('@/pages/admin/People').then(m => ({ default: m.People })));
const Audit = lazy(() => import('@/pages/admin/Audit').then(m => ({ default: m.Audit })));
const AccountAccess = lazy(() => import('@/pages/auth/AccountAccess').then(m => ({ default: m.AccountAccess })));
const Profile = lazy(() => import('@/pages/account/Account').then(m => ({ default: m.Profile })));
const Settings = lazy(() => import('@/pages/account/Account').then(m => ({ default: m.Settings })));
const Notifications = lazy(() => import('@/pages/account/Notifications').then(m => ({ default: m.Notifications })));
const Search = lazy(() => import('@/pages/Search').then(m => ({ default: m.Search })));
const Assignments = lazy(() => import('@/pages/assignments/Assignments').then(m => ({ default: m.Assignments })));
const AssignmentDetail = lazy(() => import('@/pages/assignments/Assignments').then(m => ({ default: m.AssignmentDetail })));
const Classes = lazy(() => import('@/pages/staff/Classes').then(m => ({ default: m.Classes })));
const Coding = lazy(() => import('@/pages/coding/Coding').then(m => ({ default: m.Coding })));
const CodingDetail = lazy(() => import('@/pages/coding/Coding').then(m => ({ default: m.CodingDetail })));
const Proctoring = lazy(() => import('@/pages/staff/Proctoring').then(m => ({ default: m.Proctoring })));
const Placements = lazy(() => import('@/pages/placements/Placements').then(m => ({ default: m.Placements })));
const Organizations = lazy(() => import('@/pages/admin/Organizations').then(m => ({ default: m.Organizations })));

const staff = (children: ReactNode) => <Only roles={['ADMIN', 'TEACHER']}>{children}</Only>;
const admin = (children: ReactNode) => <Only roles={['ADMIN']}>{children}</Only>;
const student = (children: ReactNode) => <Only roles={['STUDENT']}>{children}</Only>;
function Tests() { return useAuth(state => state.user?.role) === 'STUDENT' ? <StudentTests /> : staff(<StaffTests />); }
function HomeRedirect() { const user = useAuth(state => state.user); return <Navigate to={user ? ROLE_HOME[user.role] : '/sign-in'} replace />; }

/** A crash in one page must not blank the whole app. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="mx-auto max-w-md px-6 py-24">
        <h1 className="display text-3xl text-ink">This page stopped working.</h1>
        <p className="mt-2 text-md text-ink-2">Reload to try again. If it keeps happening, the error is in the browser console.</p>
        <button className={buttonClass('primary', 'md', 'mt-6')} onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    );
  }
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-6 py-24">
      <h1 className="display text-3xl text-ink">There is no page at this address.</h1>
      <p className="mt-2 text-md text-ink-2">The link may be old, or the page may have moved.</p>
      <Link to="/" className={buttonClass('primary', 'md', 'mt-6')}>
        Go to the start
      </Link>
    </div>
  );
}

export function App() {
  const location = useLocation();
  return (
    // Resets the error boundary per page; /ask and /ask/:id share a key so starting a
    // conversation doesn't remount Ask and cancel the answer it is streaming.
    <Boundary key={location.pathname.startsWith('/ask') ? '/ask' : location.pathname}>
      <Suspense fallback={<div className="mx-auto max-w-page px-6"><Spinner label="Opening your workspace" /></div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/login" element={<Navigate to="/sign-in" replace />} />
        <Route path="/register" element={<AccountAccess mode="register" />} />
        <Route path="/forgot-password" element={<AccountAccess mode="forgot" />} />
        <Route path="/reset-password" element={<AccountAccess mode="reset" />} />
        <Route path="/verify-email" element={<AccountAccess mode="verify" />} />
        <Route path="/tests/:testId/sit" element={<Exam />} />
        <Route path="/tests/:testId/take" element={<Exam />} />
        <Route path="/exam/:testId" element={<Exam />} />
        <Route element={<Shell />}>
          <Route path="/dashboard" element={<HomeRedirect />} />
          <Route path="/home" element={student(<StudentHome />)} />
          <Route path="/teach" element={staff(<StaffOverview />)} />
          <Route path="/admin" element={admin(<StaffOverview />)} />
          {/* One route, so creating a conversation (/ask -> /ask/:id) doesn't remount Ask and abort its stream. */}
          <Route path="/ask/:conversationId?" element={<Ask />} />
          <Route path="/tests" element={<Tests />} />
          <Route path="/tests/new" element={staff(<TestEditor />)} />
          <Route path="/tests/:testId" element={staff(<TestDetail />)} />
          <Route path="/results" element={<Results />} />
          <Route path="/results/:attemptId" element={<ResultDetail />} />
          <Route path="/progress" element={student(<Progress />)} />
          <Route path="/analytics" element={staff(<StaffOverview />)} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:courseId" element={<CourseDetail />} />
          <Route path="/lessons/:lessonId" element={<Lesson />} />
          <Route path="/questions" element={staff(<QuestionStudio />)} />
          <Route path="/questions/draft" element={staff(<Draft />)} />
          <Route path="/knowledge" element={staff(<Knowledge />)} />
          <Route path="/runs" element={staff(<Runs />)} />
          <Route path="/users" element={admin(<People />)} />
          <Route path="/audit" element={admin(<Audit />)} />
          <Route path="/organizations" element={admin(<Organizations />)} />
          <Route path="/placements" element={<Placements />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/search" element={<Search />} />
          <Route path="/assignments" element={<Assignments />} />
          <Route path="/assignments/:assignmentId" element={<AssignmentDetail />} />
          <Route path="/classes" element={staff(<Classes />)} />
          <Route path="/coding" element={<Coding />} />
          <Route path="/coding/:problemId" element={<CodingDetail />} />
          <Route path="/proctoring" element={<Only roles={['ADMIN', 'TEACHER', 'PROCTOR']}><Proctoring /></Only>} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </Boundary>
  );
}
