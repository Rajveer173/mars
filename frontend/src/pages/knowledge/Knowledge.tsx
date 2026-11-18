import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page, useAiStatus } from '@/app/Shell';
import { api, errorMessage } from '@/lib/api';
import { isStaffRole, useAuth } from '@/lib/auth';
import { formatNumber, plural, relative } from '@/lib/format';
import type { Course, Paged } from '@/lib/types';
import {
  Button,
  DataTable,
  Empty,
  ErrorNote,
  Field,
  Figure,
  FigureRow,
  Input,
  PageHeader,
  SectionTitle,
  Select,
  Spinner,
  Status,
  Textarea,
  type Column,
} from '@/ui/core';
import { ConfirmDialog, Dialog, toast } from '@/ui/overlay';
import type { Source } from '@/ui/trace';

interface KnowledgeDocument {
  id: string;
  title: string;
  sourceType: 'LESSON' | 'UPLOAD';
  status: string;
  error: string | null;
  charCount: number;
  lessonId: string | null;
  updatedAt: string;
  course: { id: string; name: string; code: string } | null;
  uploadedBy: { fullName: string | null } | null;
  chunks: number;
  embeddedChunks: number;
}

interface DocumentDetail extends Omit<KnowledgeDocument, 'chunks'> {
  chunkCount: number;
  chunks: { id: string; ordinal: number; heading: string | null; content: string }[];
}

interface Hit {
  chunkId: string;
  documentTitle: string;
  heading: string | null;
  course: Source['course'];
  content: string;
  lessonId: string | null;
  score: number;
  keywordRank: number | null;
  vectorRank: number | null;
}

const rank = (value: number | null) => (value == null ? 'missed' : `#${value}`);

/** Retrieval on its own: shows what the agents would be handed, with no model call. */
function RetrievalTest({ courses }: { courses: Course[] }) {
  const [query, setQuery] = useState('');
  const [courseId, setCourseId] = useState('');
  const [result, setResult] = useState<{ hits: Hit[]; mode: string; scanned: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await api.post('/ai/knowledge/search', { query: query.trim(), k: 6, ...(courseId ? { courseId } : {}) }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>Test retrieval</SectionTitle>
      <p className="mb-4 max-w-2xl text-base text-ink-2">
        Search the way the Retriever does. You see the passages it would hand to the Tutor and where each one ranked by
        keyword and by meaning. No model is called.
      </p>
      <form onSubmit={run} className="flex flex-wrap gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="For example: conditions for deadlock"
          aria-label="Search query"
          className="min-w-64 flex-1"
        />
        <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course" className="w-56">
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} {course.name}
            </option>
          ))}
        </Select>
        <Button type="submit" loading={busy} disabled={query.trim().length < 2}>
          Search
        </Button>
      </form>
      {error && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}
      {result && (
        <div className="mt-5">
          <p className="nums text-sm text-ink-2">
            {plural(result.hits.length, 'passage')} from {formatNumber(result.scanned)} scanned,{' '}
            {result.mode === 'hybrid' ? 'keyword and meaning fused' : 'keyword only'}.
          </p>
          {result.hits.length ? (
            <ol className="mt-2 border-t-[1.5px] border-ink">
              {result.hits.map((hit, index) => (
                <li key={hit.chunkId} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 border-b border-rule py-4">
                  <span className="cite !m-0 mt-0.5">{index + 1}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-base font-semibold text-ink">{hit.documentTitle}</span>
                      <span className="text-sm text-ink-2">{[hit.course?.code, hit.heading].filter(Boolean).join(', ')}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-4 max-w-measure font-serif text-[0.9375rem] leading-relaxed text-ink">{hit.content}</p>
                    <div className="nums mt-1.5 flex flex-wrap gap-x-4 text-sm text-ink-3">
                      <span>keyword {rank(hit.keywordRank)}</span>
                      <span>meaning {rank(hit.vectorRank)}</span>
                      <span>fused score {hit.score}</span>
                      {hit.lessonId && (
                        <Link to={`/lessons/${hit.lessonId}`} className="font-medium text-pen hover:underline">
                          Open lesson
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 border-t-[1.5px] border-ink py-4 text-base text-ink-2">
              No passage matched. With nothing retrieved, the Tutor is not called and the user is told the material is
              missing.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function AddDocument({ courses, defaultCourse, onDone }: { courses: Course[]; defaultCourse: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(defaultCourse);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set('title', title.trim());
      if (courseId) form.set('courseId', courseId);
      if (file) form.set('file', file);
      else form.set('text', text);
      await api.raw({ method: 'post', url: '/ai/knowledge/documents', data: form, timeout: 120_000 });
      await queryClient.invalidateQueries({ queryKey: ['ai'] });
      toast.done('Document indexed');
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <ErrorNote message={error} />}
      <Field label="Title" htmlFor="doc-title" hint="Shown beside every passage cited from this document.">
        <Input id="doc-title" required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={180} />
      </Field>
      <Field label="Course" htmlFor="doc-course" hint="Only students enrolled in this course can retrieve it. Institute-wide documents are open to everyone.">
        <Select id="doc-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          <option value="">Institute-wide</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.code} {course.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="File" htmlFor="doc-file" hint="PDF, Markdown or plain text, up to 10 MB.">
        <input
          id="doc-file"
          type="file"
          accept=".pdf,.md,.markdown,.txt,application/pdf,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-base text-ink-2 file:mr-3 file:h-9 file:cursor-pointer file:rounded-md file:border file:border-solid file:border-rule file:bg-paper file:px-3.5 file:text-base file:font-medium file:text-ink hover:file:border-ink"
        />
      </Field>
      {!file && (
        <Field label="Or paste the text" htmlFor="doc-text">
          <Textarea id="doc-text" rows={8} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-sm" />
        </Field>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={busy} disabled={!title.trim() || (!file && text.trim().length < 40)}>
          Index document
        </Button>
      </div>
    </form>
  );
}

function Passages({ id }: { id: string }) {
  const detail = useQuery({
    queryKey: ['ai', 'document', id],
    queryFn: () => api.get<{ document: DocumentDetail }>(`/ai/knowledge/documents/${id}`),
  });
  if (detail.isLoading) return <Spinner />;
  if (!detail.data) return <ErrorNote message={errorMessage(detail.error)} />;
  const { chunks } = detail.data.document;
  return (
    <ol>
      {chunks.map((chunk) => (
        <li key={chunk.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 border-b border-rule-2 py-3.5 last:border-0">
          <span className="nums text-sm text-ink-3">{chunk.ordinal + 1}</span>
          <div className="min-w-0">
            {chunk.heading && <div className="mb-1 text-sm font-semibold text-ink">{chunk.heading}</div>}
            <p className="whitespace-pre-wrap font-serif text-[0.9375rem] leading-relaxed text-ink">{chunk.content}</p>
            <div className="nums mt-1 text-xs text-ink-3">{formatNumber(chunk.content.length)} characters</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function Knowledge() {
  const user = useAuth((state) => state.user)!;
  const staff = isStaffRole(user.role);
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') ?? '';
  const queryClient = useQueryClient();
  const status = useAiStatus();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<KnowledgeDocument | null>(null);
  const [removing, setRemoving] = useState<KnowledgeDocument | null>(null);
  const [busy, setBusy] = useState(false);

  const courses = useQuery({ queryKey: ['courses', 'all'], queryFn: () => api.get<Paged<Course>>('/courses', { limit: 100 }) });
  const documents = useQuery({
    queryKey: ['ai', 'documents', courseId],
    queryFn: () => api.get<{ documents: KnowledgeDocument[] }>('/ai/knowledge/documents', courseId ? { courseId } : undefined),
  });

  const sync = async () => {
    setBusy(true);
    try {
      const result = await api.post<{ lessons: { indexed: number; unchanged: number }; embedded: number }>('/ai/knowledge/sync');
      await queryClient.invalidateQueries({ queryKey: ['ai'] });
      toast.done(
        `${plural(result.lessons.indexed, 'lesson')} re-indexed, ${result.lessons.unchanged} unchanged${result.embedded ? `, ${plural(result.embedded, 'passage')} embedded` : ''}`,
      );
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api.delete(`/ai/knowledge/documents/${removing.id}`);
      await queryClient.invalidateQueries({ queryKey: ['ai'] });
      toast.done('Document removed');
      setRemoving(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const stats = status.data?.knowledge;
  const hybrid = status.data?.embeddings.connected;
  const columns: Column<KnowledgeDocument>[] = [
    {
      key: 'title',
      header: 'Document',
      cell: (row) => (
        <div>
          <div className="font-medium text-ink">{row.title}</div>
          {row.status === 'FAILED' && <div className="text-sm text-red">{row.error}</div>}
        </div>
      ),
    },
    { key: 'course', header: 'Course', cell: (row) => <span className="text-ink-2">{row.course?.code ?? 'Institute-wide'}</span> },
    { key: 'source', header: 'Source', cell: (row) => <span className="text-ink-2">{row.sourceType === 'LESSON' ? 'Lesson' : `Uploaded${row.uploadedBy?.fullName ? ` by ${row.uploadedBy.fullName}` : ''}`}</span> },
    { key: 'chunks', header: 'Passages', align: 'right', cell: (row) => row.chunks },
    {
      key: 'embedded',
      header: 'Vectors',
      cell: (row) =>
        row.embeddedChunks >= row.chunks && row.chunks > 0 ? (
          <Status tone="tick">All embedded</Status>
        ) : row.embeddedChunks ? (
          <Status tone="pen">{row.embeddedChunks} of {row.chunks}</Status>
        ) : (
          <Status>Keyword only</Status>
        ),
    },
    { key: 'updated', header: 'Indexed', cell: (row) => <span className="text-ink-2">{relative(row.updatedAt)}</span> },
    ...(staff
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            cell: (row: KnowledgeDocument) =>
              row.sourceType === 'UPLOAD' ? (
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setRemoving(row);
                  }}
                  className="text-base font-medium text-red hover:underline"
                >
                  Remove
                </button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <Page>
      <PageHeader
        title="Knowledge base"
        description="What the agents are allowed to read. Every lesson is mirrored here when it is saved, and staff can add documents beside it. An answer can only cite a passage on this page."
        actions={
          staff && (
            <>
              <Button variant="secondary" onClick={sync} loading={busy && !removing}>
                Re-index lessons
              </Button>
              <Button onClick={() => setAdding(true)}>Add a document</Button>
            </>
          )
        }
      />

      <FigureRow>
        <Figure label="Documents" value={formatNumber(stats?.documents)} note={`across ${plural(stats?.coursesCovered ?? 0, 'course')}`} />
        <Figure label="Passages" value={formatNumber(stats?.chunks)} note="the unit that is retrieved and cited" />
        <Figure
          label="With vectors"
          value={formatNumber(stats?.embeddedChunks)}
          note={stats && stats.chunks ? `${Math.round((stats.embeddedChunks / stats.chunks) * 100)}% of passages` : undefined}
        />
        <Figure
          label="Retrieval"
          value={hybrid ? 'Hybrid' : 'Keyword'}
          note={hybrid ? `BM25 + ${status.data?.embeddings.model}` : 'BM25. Set EMBED_MODEL to add search by meaning.'}
        />
      </FigureRow>

      <div className="mt-12">
        <RetrievalTest courses={courses.data?.items ?? []} />
      </div>

      <section className="mt-14">
        <SectionTitle
          aside={
            <Select
              value={courseId}
              onChange={(e) => setParams(e.target.value ? { course: e.target.value } : {})}
              aria-label="Filter by course"
              className="!h-8 w-56 text-sm"
            >
              <option value="">All courses</option>
              {courses.data?.items.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.code} {course.name}
                </option>
              ))}
            </Select>
          }
        >
          Documents
        </SectionTitle>
        {documents.isLoading ? (
          <Spinner />
        ) : documents.isError ? (
          <ErrorNote message="Documents could not be loaded." onRetry={() => documents.refetch()} />
        ) : (
          <DataTable
            columns={columns}
            rows={documents.data?.documents ?? []}
            rowKey={(row) => row.id}
            onRowClick={setOpen}
            empty={
              <Empty title="Nothing is indexed yet" action={staff && <Button onClick={sync}>Index the lessons</Button>}>
                Lessons are indexed when they are saved. Indexing them now makes them retrievable straight away.
              </Empty>
            }
          />
        )}
      </section>

      <Dialog open={adding} onOpenChange={setAdding} title="Add a document" description="The text is split into passages and indexed immediately.">
        <AddDocument courses={courses.data?.items ?? []} defaultCourse={courseId} onDone={() => setAdding(false)} />
      </Dialog>
      <Dialog
        open={!!open}
        onOpenChange={() => setOpen(null)}
        title={open?.title ?? ''}
        description={open ? `${plural(open.chunks, 'passage')}, as the Retriever sees them.` : undefined}
        size="lg"
      >
        {open && <Passages id={open.id} />}
      </Dialog>
      <ConfirmDialog open={!!removing} onOpenChange={() => setRemoving(null)} title="Remove this document?" confirmLabel="Remove document" onConfirm={remove} busy={busy} danger>
        “{removing?.title}” and its passages leave the knowledge base. The agents can no longer retrieve or cite it.
      </ConfirmDialog>
    </Page>
  );
}
