import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Page } from '@/app/Shell';
import { api } from '@/lib/api';
import { percent } from '@/lib/format';
import type { StudentAnalytics } from '@/lib/types';
import { Empty, Figure, FigureRow, Meter, PageHeader, SectionTitle } from '@/ui/core';
import { QueryState } from '@/ui/forms';
import { BarList } from '@/ui/charts';

export function Progress() {
  const query = useQuery({ queryKey: ['analytics', 'me', '90d'], queryFn: () => api.get<StudentAnalytics>('/analytics/me', { range: '90d' }) });
  const data = query.data;
  return <Page><PageHeader title="Your progress" description="Small steps, lasting understanding. Your last 90 days of learning." /><QueryState query={query}>{data && <>
    <FigureRow><Figure label="Assessments" value={data.kpis.attempts} /><Figure label="Average score" value={percent(data.kpis.avgScore)} /><Figure label="Lessons completed" value={data.kpis.lessonsCompleted} /><Figure label="Study streak" value={`${data.kpis.streakDays} days`} /></FigureRow>
    <div className="mt-12 grid gap-10 lg:grid-cols-2"><section><SectionTitle>Course completion</SectionTitle>{!data.byCourse.length && <Empty title="Your learning starts here">Join a course to begin tracking your progress.</Empty>}{data.byCourse.map(course => <Link to={`/courses/${course.courseId}`} key={course.courseId} className="block border-t border-rule py-4"><div className="mb-3 flex justify-between gap-4"><span>{course.title}</span><span className="nums text-ink-3">{percent(course.progress)}</span></div><Meter value={course.progress} tone="pen" /></Link>)}</section><section><SectionTitle>Assessment scores by course</SectionTitle><BarList rows={data.byCourse.map(course => ({ label: course.title, value: course.avgScore }))} /></section></div>
  </>}</QueryState></Page>;
}
