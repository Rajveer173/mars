import {
  Activity,
  BookOpen,
  Briefcase,
  Building2,
  ChartNoAxesColumn,
  ClipboardList,
  CodeXml,
  FileCheck,
  GraduationCap,
  Highlighter,
  House,
  Library,
  ListChecks,
  ScrollText,
  SquareCheckBig,
  TrendingUp,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/lib/auth';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const ask: NavItem = { to: '/ask', label: 'Ask', icon: Highlighter };
const courses: NavItem = { to: '/courses', label: 'Courses', icon: BookOpen };
const knowledge: NavItem = { to: '/knowledge', label: 'Knowledge base', icon: Library };
const runs: NavItem = { to: '/runs', label: 'Agent runs', icon: Activity };
const placements: NavItem = { to: '/placements', label: 'Placements', icon: Briefcase };

const staffAssess: NavItem[] = [
  { to: '/questions', label: 'Question studio', icon: ListChecks },
  { to: '/tests', label: 'Tests', icon: FileCheck },
  { to: '/results', label: 'Results', icon: SquareCheckBig },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumn },
];
const staffWork: NavItem[] = [
  { to: '/assignments', label: 'Assignments', icon: ClipboardList },
  { to: '/coding', label: 'Coding problems', icon: CodeXml },
  { to: '/classes', label: 'Classes', icon: GraduationCap },
  { to: '/proctoring', label: 'Proctoring', icon: Video },
];

const admin: NavGroup[] = [
  {
    label: 'Institute',
    items: [
      { to: '/admin', label: 'Overview', icon: House, end: true },
      { to: '/users', label: 'People', icon: Users },
      { to: '/organizations', label: 'Organisation', icon: Building2 },
      { to: '/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
  { label: 'Agents', items: [ask, knowledge, runs] },
  { label: 'Assessment', items: staffAssess },
  { label: 'Coursework', items: [courses, ...staffWork, placements] },
];

/**
 * Navigation is a map of places, grouped by what a person comes to do. The same
 * path serves every role; the page decides what that role sees there.
 */
export const NAV: Record<Role, NavGroup[]> = {
  STUDENT: [
    { label: 'Study', items: [{ to: '/home', label: 'Home', icon: House, end: true }, ask, courses] },
    {
      label: 'Exams',
      items: [
        { to: '/tests', label: 'Tests', icon: FileCheck },
        { to: '/results', label: 'Results', icon: SquareCheckBig },
        { to: '/progress', label: 'Progress', icon: TrendingUp },
      ],
    },
    {
      label: 'Coursework',
      items: [
        { to: '/assignments', label: 'Assignments', icon: ClipboardList },
        { to: '/coding', label: 'Coding problems', icon: CodeXml },
        placements,
      ],
    },
  ],
  TEACHER: [
    { label: 'Teach', items: [{ to: '/teach', label: 'Overview', icon: House, end: true }, courses] },
    { label: 'Agents', items: [ask, knowledge, runs] },
    { label: 'Assessment', items: staffAssess },
    { label: 'Coursework', items: [...staffWork, placements] },
  ],
  ADMIN: admin,
  ORG_ADMIN: admin,
  PROCTOR: [
    {
      label: 'Invigilation',
      items: [
        { to: '/proctoring', label: 'Live sessions', icon: Video, end: true },
        { to: '/placements', label: 'Placement tests', icon: Briefcase },
      ],
    },
    { label: 'Reference', items: [ask, courses] },
  ],
};
