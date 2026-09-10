"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "./AdminShell";
import { Button, Card } from "../ui/Primitives";
import { IconArrowRight, IconSpinner } from "../ui/Icons";
import { useRequireAdmin } from "../../hooks/useAdminAuth";

/**
 * Honest stand-in for a console section that has no backend behind it yet.
 *
 * The sidebar shows the full product navigation, so these routes exist to say
 * plainly that the section is not built - rather than 404, or worse, render a
 * convincing screen full of invented numbers.
 */
export function SectionPlaceholder({
  title,
  description,
  icon,
  available,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  /** What genuinely exists today, if anything. */
  available?: ReactNode;
}) {
  const { loading, isAdmin } = useRequireAdmin();

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

  return (
    <AdminShell breadcrumbs={[{ label: title }]}>
      <div className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl border border-line bg-panel-2 text-dim">
            {icon}
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-bold tracking-tight">
              {title}
            </h1>
            <p className="mt-0.5 text-[13px] text-muted">{description}</p>
          </div>
        </div>

        <Card className="mt-6 p-6 text-center">
          <p className="text-[15px] font-semibold text-fg">Not built yet</p>
          <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-dim">
            {available ?? (
              <>
                This section has no backend behind it yet, so there is nothing
                real to show. It is listed here so the navigation matches the
                product design.
              </>
            )}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href="/users">
              <Button iconRight={<IconArrowRight size={14} />}>Go to Users</Button>
            </Link>
            <Link href="/challenges">
              <Button iconRight={<IconArrowRight size={14} />}>
                Go to Challenges
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
