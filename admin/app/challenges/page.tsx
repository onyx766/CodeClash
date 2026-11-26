"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "../../lib/api";
import { challengeService } from "../../services/challenge.service";
import { useRequireAdmin } from "../../hooks/useAdminAuth";
import { AdminShell } from "../../components/layout/AdminShell";
import {
  Badge,
  Button,
  Card,
  Notice,
  Tabs,
  TextInput,
  cx,
} from "../../components/ui/Primitives";
import {
  IconChevronRight,
  IconPlus,
  IconSpinner,
  IconTrophy,
} from "../../components/ui/Icons";
import { BattleEligibilityBadge, BattlePoolPanel } from "../../components/challenges/BattlePoolPanel";
import { DIFFICULTIES } from "../../lib/draft";
import type {
  AdminChallengeSummary,
  BatchValidationResponse,
  BattlePool,
  ChallengeStatus,
} from "../../lib/types";

type Filter = "ALL" | ChallengeStatus;

const VALIDATION_TONE = {
  PASSED: "green",
  FAILED: "rose",
  NOT_CHECKED: "neutral",
} as const;

const GRID = "md:grid-cols-[minmax(0,2fr)_110px_110px_130px_150px_minmax(150px,1fr)_20px]";

const describe = (caught: unknown, fallback: string) =>
  caught instanceof ApiError ? caught.message : fallback;

function ChallengesPageInner() {
  const { loading, isAdmin } = useRequireAdmin();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState(urlSearch);

  // The topbar search navigates here with ?search=. Follow it whenever it
  // changes, including while this page is already open.
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    setSearch(urlSearch);
  }
  const [rows, setRows] = useState<AdminChallengeSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pool, setPool] = useState<BattlePool | null>(null);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [poolRefreshing, setPoolRefreshing] = useState(false);
  const [batch, setBatch] = useState<BatchValidationResponse | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);

  const load = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const response = await challengeService.list({
        status: filter === "ALL" ? undefined : filter,
        search: search.trim() || undefined,
      });
      setRows(response.challenges);
    } catch (caught) {
      setError(describe(caught, "Could not load challenges."));
    } finally {
      setFetching(false);
    }
  }, [filter, search]);

  const loadPool = useCallback(async () => {
    setPoolRefreshing(true);
    try {
      const response = await challengeService.battlePool();
      setPool(response.pool);
      setPoolError(null);
    } catch (caught) {
      setPoolError(describe(caught, "Could not load the battle pool."));
    } finally {
      setPoolRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [isAdmin, load, search]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = setTimeout(() => void loadPool(), 0);
    return () => clearTimeout(timer);
  }, [isAdmin, loadPool]);

  const validatePublished = async () => {
    setBatchRunning(true);
    setPoolError(null);
    try {
      setBatch(await challengeService.validatePublished());
    } catch (caught) {
      setPoolError(describe(caught, "The checks could not be run."));
    } finally {
      setBatchRunning(false);
      void loadPool();
      void load();
    }
  };

  if (loading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="flex items-center gap-2 text-[13px] text-dim">
          <IconSpinner size={16} />
          Loading admin console…
        </span>
      </div>
    );
  }

  const poolById = new Map((pool?.challenges ?? []).map((entry) => [entry.id, entry]));

  return (
    <AdminShell breadcrumbs={[{ label: "Challenges" }]}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-blue/25 bg-gradient-to-br from-blue/25 to-violet/10 text-blue-soft">
              <IconTrophy size={20} />
            </span>
            <div>
              <h1 className="text-[26px] leading-tight font-bold tracking-tight">
                Challenges
              </h1>
              <p className="mt-0.5 text-[13px] text-muted">
                Drafts, published problems and the archive. Open a challenge to run its checks.
              </p>
            </div>
          </div>
          <Link href="/challenges/create">
            <Button variant="primary" icon={<IconPlus size={15} />}>
              Create Challenge
            </Button>
          </Link>
        </div>

        <div className="mt-5">
          <BattlePoolPanel
            pool={pool}
            error={poolError}
            refreshing={poolRefreshing}
            batch={batch}
            batchRunning={batchRunning}
            onRefresh={() => void loadPool()}
            onValidatePublished={() => void validatePublished()}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Tabs<Filter>
            value={filter}
            onChange={setFilter}
            tabs={[
              { value: "ALL", label: "All" },
              { value: "DRAFT", label: "Drafts" },
              { value: "PUBLISHED", label: "Published" },
              { value: "ARCHIVED", label: "Archived" },
            ]}
          />
          <TextInput
            className="max-w-xs"
            placeholder="Search by title or slug…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {fetching ? <IconSpinner size={15} className="text-dim" /> : null}
        </div>

        {error ? (
          <div className="mt-4">
            <Notice tone="rose">{error}</Notice>
          </div>
        ) : null}

        <Card className="mt-4 overflow-hidden">
          <div
            className={cx(
              "hidden gap-3 border-b border-line bg-[rgba(9,14,28,0.6)] px-4 py-2.5 md:grid",
              GRID,
            )}
          >
            <span className="eyebrow">Challenge</span>
            <span className="eyebrow">Difficulty</span>
            <span className="eyebrow">Status</span>
            <span className="eyebrow">Validation</span>
            <span className="eyebrow">Tests</span>
            <span className="eyebrow">Battle</span>
            <span />
          </div>

          {rows.length === 0 && !fetching ? (
            <p className="px-4 py-12 text-center text-[13px] text-dim">
              No challenges match this filter.
            </p>
          ) : (
            <ul>
              {rows.map((row) => {
                const difficulty = DIFFICULTIES.find(
                  (entry) => entry.value === row.difficulty,
                );
                return (
                  <li key={row.id} className="border-b border-line-soft last:border-b-0">
                    <Link
                      href={`/challenges/${row.id}`}
                      className={cx(
                        "grid gap-2 px-4 py-3 hover:bg-panel-2/40 md:items-center md:gap-3",
                        GRID,
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-fg">
                          {row.title}
                        </p>
                        <p className="mono truncate text-[11px] text-dim">
                          /{row.slug} · {row.judgeMethod}
                        </p>
                      </div>

                      <span className="flex items-center gap-1.5 text-[12px] text-muted">
                        <span
                          className={cx("size-1.5 rounded-full", difficulty?.tone)}
                        />
                        {difficulty?.label}
                      </span>

                      <Badge
                        tone={
                          row.status === "PUBLISHED"
                            ? "green"
                            : row.status === "ARCHIVED"
                              ? "neutral"
                              : "blue"
                        }
                        className="w-fit"
                      >
                        {row.status}
                      </Badge>

                      <Badge
                        tone={VALIDATION_TONE[row.validationStatus]}
                        className="w-fit"
                      >
                        {row.validationStatus.replace("_", " ")}
                      </Badge>

                      <span className="mono text-[11.5px] text-dim">
                        {row.publicTestCount} public · {row.hiddenTestCount} hidden
                      </span>

                      <BattleEligibilityBadge entry={poolById.get(row.id)} />

                      <IconChevronRight size={15} className="hidden text-dim md:block" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

export default function ChallengesPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <IconSpinner size={18} />
        </div>
      }
    >
      <ChallengesPageInner />
    </Suspense>
  );
}
