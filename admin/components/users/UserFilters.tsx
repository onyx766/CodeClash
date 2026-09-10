"use client";

import { Button, Select, TextInput, cx } from "../ui/Primitives";
import { IconSearch, IconSliders } from "../ui/Icons";
import type { JoinWindow, ListUsersQuery, UserRole, UserStatus } from "../../lib/types";

const JOIN_WINDOWS: { value: JoinWindow; label: string }[] = [
  { value: "24h", label: "Last 24 hours" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
];

export function UserFilters({
  filters,
  onChange,
  onReset,
}: {
  filters: ListUsersQuery;
  onChange: (next: Partial<ListUsersQuery>) => void;
  onReset: () => void;
}) {
  const dirty =
    !!filters.search || !!filters.role || !!filters.status || !!filters.joinedWithin;

  return (
    <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-4 py-3">
      <div className="relative min-w-[220px] flex-1">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim">
          <IconSearch size={15} />
        </span>
        <TextInput
          className="h-9 pl-9"
          placeholder="Search users by username, email, or ID…"
          aria-label="Search users"
          value={filters.search ?? ""}
          onChange={(event) => onChange({ search: event.target.value })}
        />
      </div>

      <Select
        className="h-9 w-[150px]"
        aria-label="Filter by role"
        value={filters.role ?? ""}
        onChange={(event) =>
          onChange({ role: (event.target.value || undefined) as UserRole | undefined })
        }
      >
        <option value="">All Roles</option>
        <option value="USER">User</option>
        <option value="ADMIN">Admin</option>
        <option value="MASTER">Master</option>
      </Select>

      <Select
        className="h-9 w-[160px]"
        aria-label="Filter by status"
        value={filters.status ?? ""}
        onChange={(event) =>
          onChange({
            status: (event.target.value || undefined) as UserStatus | undefined,
          })
        }
      >
        <option value="">All Statuses</option>
        <option value="ACTIVE">Active</option>
        <option value="BANNED">Banned</option>
      </Select>

      <Select
        className="h-9 w-[170px]"
        aria-label="Filter by join date"
        value={filters.joinedWithin ?? ""}
        onChange={(event) =>
          onChange({
            joinedWithin: (event.target.value || undefined) as JoinWindow | undefined,
          })
        }
      >
        <option value="">All Join Dates</option>
        {JOIN_WINDOWS.map((window) => (
          <option key={window.value} value={window.value}>
            {window.label}
          </option>
        ))}
      </Select>

      <Button
        size="sm"
        className={cx("h-9", dirty && "border-blue/40 text-blue-soft")}
        icon={<IconSliders size={14} />}
        disabled={!dirty}
        onClick={onReset}
      >
        Reset
      </Button>
    </div>
  );
}
