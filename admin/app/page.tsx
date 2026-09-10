"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "../hooks/useAdminAuth";
import { challengeService } from "../services/challenge.service";
import { AdminShell } from "../components/layout/AdminShell";
import { Badge, Button, Card, cx } from "../components/ui/Primitives";
import {
  IconArrowRight,
  IconCheckCircle,
  IconFile,
  IconPlus,
  IconSpinner,
  IconTrophy,
} from "../components/ui/Icons";
import type { AdminChallengeSummary } from "../lib/types";

/**
 * Console landing page. Only the challenge-authoring feature is built out, so
 * this stays a small overview that points at it rather than pretending to
 * summarise sections that do not exist yet.
 */
export default function AdminHomePage() {
  const { user, loading, isAdmin } = useAdminAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AdminChallengeSummary[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.replace("/login");
  }, [loading, user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    challengeService
      .list()
      .then((response) => setRows(response.challenges))
      .catch(() => setRows([]));
  }, [isAdmin]);

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

  const drafts = rows?.filter((row) => row.status === "DRAFT").length ?? 0;
  const published = rows?.filter((row) => row.status === "PUBLISHED").length ?? 0;
  const validated =
    rows?.filter((row) => row.validationStatus === "PASSED").length ?? 0;

  const stats = [
    { label: "Published", value: published, tone: "green" as const },
    { label: "Drafts", value: drafts, tone: "blue" as const },
    { label: "Validation passed", value: validated, tone: "teal" as const },
  ];

  return (
    <AdminShell breadcrumbs={[{ label: "Dashboard" }]}>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
        <p className="eyebrow">Administrator Platform</p>
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">
          Welcome back, {user?.username}.
        </h1>
        <p className="mt-1 text-[13.5px] text-muted">
          Author, validate and publish the problems players compete on.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="eyebrow">{stat.label}</p>
              <p className="mt-1.5 text-[28px] leading-none font-bold">
                {rows === null ? "—" : stat.value}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <span className="grid size-10 place-items-center rounded-xl border border-blue/25 bg-gradient-to-br from-blue/25 to-violet/10 text-blue-soft">
              <IconTrophy size={20} />
            </span>
            <h2 className="mt-3 text-[16px] font-semibold">Create a challenge</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-dim">
              Write it manually, import a JSON file, or generate a draft with AI.
              Every route produces the same reviewable draft, validated by the
              isolated code runner before it can be published.
            </p>
            <Link href="/challenges/create" className="mt-4 inline-block">
              <Button variant="primary" icon={<IconPlus size={15} />}>
                Create Challenge
              </Button>
            </Link>
          </Card>

          <Card className="p-5">
            <span className="grid size-10 place-items-center rounded-xl border border-teal/25 bg-gradient-to-br from-teal/25 to-teal/5 text-teal-300">
              <IconCheckCircle size={20} />
            </span>
            <h2 className="mt-3 text-[16px] font-semibold">Recent challenges</h2>
            {rows === null ? (
              <p className="mt-3 text-[12.5px] text-dim">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-dim">
                Nothing authored yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {rows.slice(0, 5).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-[9px] border border-line bg-panel-2/40 px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-fg">
                        {row.title}
                      </span>
                      <span className="mono block truncate text-[10.5px] text-dim">
                        /{row.slug}
                      </span>
                    </span>
                    <Badge
                      tone={
                        row.status === "PUBLISHED"
                          ? "green"
                          : row.status === "ARCHIVED"
                            ? "neutral"
                            : "blue"
                      }
                    >
                      {row.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/challenges"
              className={cx(
                "mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold",
                "text-blue-soft transition-colors hover:text-fg",
              )}
            >
              View all challenges
              <IconArrowRight size={14} />
            </Link>
          </Card>
        </div>

        <Card className="mt-4 flex flex-wrap items-center gap-3 p-4">
          <IconFile size={16} className="text-dim" />
          <p className="text-[12.5px] text-dim">
            Sections beyond challenge authoring are not built yet — the sidebar
            links are placeholders.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
