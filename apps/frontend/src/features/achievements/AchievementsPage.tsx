import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, RotateCcw, Trash2, Trophy } from 'lucide-react';
import type {
  Achievement,
  ImageConfig,
  LatestAchievement,
  PublicAchievementsResponse,
} from '@zenith/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { EmptyState } from '@/components/patterns/EmptyState';
import { Kbd } from '@/components/patterns/Kbd';
import { ListState } from '@/components/patterns/ListState';
import { PageHeader } from '@/components/patterns/PageHeader';
import { SearchInput } from '@/components/patterns/SearchInput';
import { CardGridSkeleton } from '@/components/patterns/skeletons';
import { AchievementFormDialog } from '@/features/achievements/AchievementFormDialog';
import { achievementsApi } from '@/features/achievements/api';
import {
  toAchievementPayload,
  type AchievementFormValues,
} from '@/features/achievements/schema';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { api } from '@/lib/api';

function aspectToCss(aspect?: string): string {
  if (!aspect) return '16 / 9';
  const [rawW, rawH] = aspect.split(':');
  const w = Number(rawW);
  const h = Number(rawH);
  return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `${w} / ${h}` : '16 / 9';
}

function imageStyle(cfg?: ImageConfig) {
  if (!cfg) return undefined;
  return {
    objectPosition: `${cfg.x}% ${cfg.y}%`,
    transform: `scale(${cfg.zoom}) rotate(${cfg.rotate ?? 0}deg)`,
  };
}

function matchesKeyword(parts: Array<string | undefined>, query: string): boolean {
  if (!query) return true;
  return parts.some((part) => part?.toLowerCase().includes(query));
}

export default function AchievementsPage() {
  useDocumentTitle('Achievements');

  const [data, setData] = useState<PublicAchievementsResponse>({
    latestAchievements: [],
    yearlyAchievementsByYear: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    achievementsApi
      .listGrouped()
      .then((res) => {
        if (active) {
          setData(res.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load achievements');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadNonce]);

  const reload = () => {
    setLoading(true);
    setError(null);
    setReloadNonce((n) => n + 1);
  };

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = async (target: { id: string; title: string }) => {
    try {
      const res = await api<{ data: Achievement }>(
        `/achievements/${encodeURIComponent(target.id)}`,
      );
      setEditing(res.data);
      setFormOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to load ${target.title}`);
    }
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

  const submit = async (values: AchievementFormValues) => {
    const payload = toAchievementPayload(values);
    setSaving(true);
    try {
      if (editing) {
        const { id: _id, ...updates } = payload;
        await achievementsApi.update(editing.id, {
          ...updates,
          position: editing.position,
        });
        toast.success('Achievement updated');
      } else {
        await achievementsApi.create(payload);
        toast.success('Achievement added');
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save achievement');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const target = deleting;
    setRemoving(true);
    try {
      await achievementsApi.remove(target.id);
      setDeleting(null);
      toast.success('Achievement deleted');
      reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete achievement');
    } finally {
      setRemoving(false);
    }
  };

  const keyword = search.trim().toLowerCase();
  const years = data.yearlyAchievementsByYear.map((group) => group.year);

  const visibleFeatured: LatestAchievement[] = yearFilter
    ? []
    : data.latestAchievements.filter((item) =>
        matchesKeyword([item.title, item.award, item.teamName, ...item.members], keyword),
      );

  const filteredYears = data.yearlyAchievementsByYear
    .filter((group) => !yearFilter || String(group.year) === yearFilter)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        matchesKeyword([item.title, item.award, String(item.year)], keyword),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const yearlyCount = filteredYears.reduce((sum, group) => sum + group.items.length, 0);
  const hasFilter = Boolean(search || yearFilter);

  const resetFilters = () => {
    setSearch('');
    setYearFilter('');
  };

  return (
    <>
      <PageHeader
        title="Achievements"
        description={
          <>
            Featured competition spotlight and yearly archive. Press <Kbd>n</Kbd> to add,{' '}
            <Kbd>/</Kbd> to search.
          </>
        }
        actions={
          <Button type="button" onClick={openCreate}>
            <Plus aria-hidden="true" />
            Add achievement
          </Button>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <SearchInput
          ref={searchRef}
          placeholder="Search title, award, or team"
          aria-label="Search achievements"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={search ? () => setSearch('') : undefined}
        />
        <Select
          value={yearFilter || 'all'}
          onValueChange={(value) => setYearFilter(value === 'all' ? '' : (value ?? ''))}
        >
          <SelectTrigger className="w-full" aria-label="Filter year">
            <SelectValue placeholder="All years">
              {yearFilter || 'All years'}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)} className="font-mono tabular-nums">
                {year}
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
        loading={loading}
        error={error}
        isEmpty={visibleFeatured.length === 0 && filteredYears.length === 0}
        onRetry={reload}
        skeleton={<CardGridSkeleton count={6} />}
        empty={
          <EmptyState
            icon={Trophy}
            title={hasFilter ? 'No matching achievements' : 'No achievements yet'}
            description={
              hasFilter
                ? 'Change the keyword or year filter used.'
                : 'Add the first achievement to populate the showcase and archive.'
            }
            action={
              hasFilter ? (
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Reset filter
                </Button>
              ) : (
                <Button type="button" onClick={openCreate}>
                  <Plus aria-hidden="true" />
                  Add achievement
                </Button>
              )
            }
          />
        }
      >
        <div className="space-y-8">
          {visibleFeatured.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Featured Showcase
                </h2>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {visibleFeatured.length}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {visibleFeatured.map((item) => {
                  const showOverlay = item.showOverlay !== false;
                  return (
                    <Card key={item.id} className="gap-0 overflow-hidden py-0">
                      <div
                        className="relative w-full overflow-hidden bg-muted"
                        style={{ aspectRatio: aspectToCss(item.imageConfig?.aspect) }}
                      >
                        <img
                          src={item.image}
                          alt={item.title}
                          style={imageStyle(item.imageConfig)}
                          className="size-full object-cover"
                        />
                        {showOverlay ? (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/75 to-transparent p-4 pt-10">
                            <Badge variant="secondary" className="mb-1.5 font-mono">
                              {item.award}
                            </Badge>
                            <h3 className="text-sm font-semibold leading-snug text-foreground">
                              {item.title}
                            </h3>
                          </div>
                        ) : null}
                      </div>

                      <CardContent className="flex flex-1 flex-col gap-3 py-4">
                        {!showOverlay ? (
                          <div className="space-y-1">
                            <Badge variant="secondary" className="font-mono">
                              {item.award}
                            </Badge>
                            <h3 className="text-sm font-semibold leading-snug text-foreground">
                              {item.title}
                            </h3>
                          </div>
                        ) : null}

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {item.teamName}
                          </p>
                          <p className="line-clamp-3 text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {item.members.map((member) => (
                            <Badge
                              key={member}
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {member}
                            </Badge>
                          ))}
                        </div>

                        <div className="mt-auto flex justify-end gap-1 pt-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${item.title}`}
                            onClick={() => openEdit(item)}
                          >
                            <Pencil aria-hidden="true" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${item.title}`}
                            onClick={() => setDeleting({ id: item.id, title: item.title })}
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ) : null}

          {filteredYears.length > 0 ? (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Yearly Archive
                </h2>
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {yearlyCount}
                </Badge>
              </div>

              <div className="space-y-4">
                {filteredYears.map((group) => (
                  <Card key={group.year} className="gap-0 overflow-hidden py-0">
                    <CardContent className="p-0">
                      <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <h3 className="font-mono text-base font-semibold tabular-nums text-foreground">
                          {group.year}
                        </h3>
                        <Badge variant="outline" className="font-mono tabular-nums">
                          {group.items.length}
                        </Badge>
                      </div>

                      <ul className="divide-y divide-border">
                        {group.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {item.title}
                              </span>
                              {item.award ? (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {item.award}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Edit ${item.title}`}
                                onClick={() => openEdit(item)}
                              >
                                <Pencil aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Delete ${item.title}`}
                                onClick={() => setDeleting({ id: item.id, title: item.title })}
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </ListState>

      <AchievementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        saving={saving}
        onDelete={(item) => {
          setFormOpen(false);
          setDeleting({ id: item.id, title: item.title });
        }}
        onImageSaved={() => {
          void reload();
        }}
        onSubmit={submit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="Delete achievement"
        description={
          <>
            Delete <strong>{deleting?.title}</strong> from achievements? This action cannot be
            undone.
          </>
        }
        confirmLabel="Delete achievement"
        pending={removing}
        onConfirm={confirmDelete}
      />
    </>
  );
}
