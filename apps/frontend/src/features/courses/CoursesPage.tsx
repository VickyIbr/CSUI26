import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { BookOpen, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/patterns/EmptyState';
import { ListState } from '@/components/patterns/ListState';
import { PageHeader } from '@/components/patterns/PageHeader';
import { SearchInput } from '@/components/patterns/SearchInput';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { ListSkeleton } from '@/components/patterns/skeletons';
import { Kbd } from '@/components/patterns/Kbd';
import { Paginator } from '@/components/Paginator';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useResourceList } from '@/hooks/useResourceList';
import { api } from '@/lib/api';
import { coursesApi } from '@/features/courses/api';
import { CourseFormDialog } from '@/features/courses/CourseFormDialog';
import { CourseRowCard } from '@/features/courses/CourseRowCard';
import type { CourseFormValues } from '@/features/courses/schema';
import type { Course, CourseRow, ProgramOption } from '@/features/courses/types';
import type { Program } from '@/features/programs/types';

const PAGE_SIZE = 20;

export default function CoursesPage() {
  useDocumentTitle('Courses');

  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get('search') ?? '');
  const [programFilter, setProgramFilter] = useState(() => searchParams.get('program') ?? '');
  const [semesterFilter, setSemesterFilter] = useState(() => searchParams.get('semester') ?? '');
  const [sksFilter, setSksFilter] = useState(() => searchParams.get('sks') ?? '');
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourseRow | null>(null);
  const [deleting, setDeleting] = useState<CourseRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const list = useResourceList<CourseRow>({
    path: '/courses',
    pageSize: PAGE_SIZE,
    filters: { search, program: programFilter, semester: semesterFilter, sks: sksFilter },
  });

  useEffect(() => {
    const controller = new AbortController();
    api<{ data: Program[] }>('/programs', { signal: controller.signal })
      .then((response) => {
        setPrograms(response.data.map(({ id, name }) => ({ id, name })));
      })
      .catch(() => {
        if (!controller.signal.aborted) toast.error('Failed to load study programs');
      });
    return () => controller.abort();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (row: CourseRow) => {
    setEditing(row);
    setFormOpen(true);
  };

  useKeyboardShortcuts(
    {
      n: openCreate,
      '/': (event) => {
        event.preventDefault();
        searchRef.current?.focus();
      },
    },
    !formOpen && !deleting,
  );

  const submit = async (values: CourseFormValues) => {
    const course: Course = {
      ...(editing?.course.id ? { id: editing.course.id } : {}),
      name: values.name,
      code: values.code,
      sks: values.sks,
      description: values.description,
    };
    const programName = programs.find((item) => item.id === values.programId)?.name ?? values.programId;
    const snapshot = list.data;
    setSaving(true);
    setFormOpen(false);

    const editingId = editing?.course.id;
    if (editingId !== undefined && editing) {
      const target = editing;
      list.mutate((rows) =>
        rows.map((row) =>
          row.course.id === target.course.id
            ? {
                ...row,
                programId: values.programId,
                programName,
                semester: values.semester,
                course: { ...row.course, ...course },
              }
            : row,
        ),
      );
      try {
        await coursesApi.update(editingId, {
          ...course,
          programId: values.programId,
          semester: values.semester,
        });
        toast.success('Course updated');
        list.reload();
      } catch (err) {
        list.mutate(() => snapshot);
        toast.error(err instanceof Error ? err.message : 'Failed to save course');
        setFormOpen(true);
      } finally {
        setSaving(false);
      }
      return;
    }

    const optimistic: CourseRow = {
      programId: values.programId,
      programName,
      semester: values.semester,
      course,
    };

    list.mutate((rows) => [optimistic, ...rows]);
    try {
      await coursesApi.create({
        programId: values.programId,
        semester: values.semester,
        course,
      });
      toast.success('Course added');
      list.reload();
    } catch (err) {
      list.mutate(() => snapshot);
      toast.error(err instanceof Error ? err.message : 'Failed to save course');
      setFormOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const targetId = deleting?.course.id;
    if (targetId === undefined) return;
    const snapshot = list.data;
    setRemoving(true);
    setDeleting(null);
    list.mutate((rows) => rows.filter((row) => row.course.id !== targetId));
    try {
      await coursesApi.remove(targetId);
      toast.success('Course deleted');
      list.reload();
    } catch (err) {
      list.mutate(() => snapshot);
      toast.error(err instanceof Error ? err.message : 'Failed to delete course');
    } finally {
      setRemoving(false);
    }
  };

  const programItems: Record<string, string> = { all: 'All programs' };
  for (const program of programs) programItems[program.id] = program.name;
  const sksItems: Record<string, string> = { all: 'All SKS' };
  for (const sks of [2, 3, 4, 6]) sksItems[String(sks)] = `${sks} SKS`;

  const hasFilter = Boolean(search || programFilter || semesterFilter || sksFilter);

  const resetFilters = () => {
    setSearch('');
    setProgramFilter('');
    setSemesterFilter('');
    setSksFilter('');
  };

  return (
    <>
      <PageHeader
        title="Courses"
        description={
          <>
            Search and manage courses for each study program. Press <Kbd>n</Kbd> to add,{' '}
            <Kbd>/</Kbd> to search.
          </>
        }
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Add course
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_12rem_7rem_8rem_auto]">
        <SearchInput
          ref={searchRef}
          placeholder="Search name or code"
          aria-label="Search courses"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={search ? () => setSearch('') : undefined}
        />
        <Select
          value={programFilter || 'all'}
          onValueChange={(value) => setProgramFilter(value === 'all' ? '' : (value ?? ''))}
        >
          <SelectTrigger className="w-full" aria-label="Filter study program">
            <SelectValue placeholder="All programs">{programItems[programFilter || 'all']}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All programs</SelectItem>
            {programs.map((program) => (
              <SelectItem key={program.id} value={program.id}>
                {program.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Semester"
          aria-label="Filter semester"
          inputMode="numeric"
          value={semesterFilter}
          onChange={(event) => setSemesterFilter(event.target.value)}
        />
        <Select
          value={sksFilter || 'all'}
          onValueChange={(value) => setSksFilter(value === 'all' ? '' : (value ?? ''))}
        >
          <SelectTrigger className="w-full" aria-label="Filter SKS">
            <SelectValue placeholder="All SKS">{sksItems[sksFilter || 'all']}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All SKS</SelectItem>
            {[2, 3, 4, 6].map((sks) => (
              <SelectItem key={sks} value={String(sks)}>
                {sks} SKS
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilter ? (
          <Button type="button" variant="ghost" onClick={resetFilters}>
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
        ) : null}
      </div>

      <ListState
        loading={list.loading}
        error={list.error}
        isEmpty={list.data.length === 0}
        onRetry={list.reload}
        skeleton={<ListSkeleton rows={6} />}
        empty={
          <EmptyState
            icon={BookOpen}
            title={hasFilter ? 'No matching courses' : 'No courses yet'}
            description={
              hasFilter
                ? 'Change the keyword or filter used.'
                : 'Add the first course for an existing study program.'
            }
            action={
              hasFilter ? (
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Reset filter
                </Button>
              ) : (
                <Button type="button" onClick={openCreate}>
                  <Plus aria-hidden="true" />
                  Add course
                </Button>
              )
            }
          />
        }
      >
        <div className="space-y-2">
          {list.data.map((row, index) => (
            <CourseRowCard
              key={row.course.id ?? `baru-${index}`}
              row={row}
              onEdit={openEdit}
              onDelete={setDeleting}
            />
          ))}
        </div>
        <Paginator
          page={list.page}
          totalPages={list.totalPages}
          total={list.total}
          onPageChange={list.setPage}
        />
      </ListState>

      <CourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        programs={programs}
        saving={saving}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete course"
        description={
          <>
            Delete <strong>{deleting?.course.name}</strong> from {deleting?.programName}? This action cannot be undone.
          </>
        }
        confirmLabel="Delete course"
        pending={removing}
        onConfirm={confirmDelete}
      />
    </>
  );
}



