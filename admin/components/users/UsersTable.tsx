"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Checkbox, cx } from "../ui/Primitives";
import {
  IconAnalytics,
  IconBan,
  IconChevronDown,
  IconChevronUp,
  IconCopy,
  IconPencil,
  IconShieldCheck,
  IconSpinner,
} from "../ui/Icons";
import {
  activityTone,
  avatarGradient,
  formatDate,
  formatNumber,
  formatRelative,
  initials,
} from "../../lib/format";
import type { AdminUser, UserRole, UserSortField } from "../../lib/types";

const ROLE_TONE = {
  USER: "neutral",
  ADMIN: "blue",
  MASTER: "violet",
} as const;

const ACTIVITY_DOT = {
  green: "bg-green",
  amber: "bg-amber",
  neutral: "bg-dim",
} as const;

export function UsersTable({
  users,
  loading,
  selected,
  onSelectedChange,
  sortBy,
  sortDir,
  onSort,
  canChangeRole,
  currentUserId,
  busyUserId,
  onBan,
  onUnban,
  onChangeRole,
  onOpen,
}: {
  users: AdminUser[];
  loading: boolean;
  selected: Set<string>;
  onSelectedChange: (next: Set<string>) => void;
  sortBy: UserSortField;
  sortDir: "asc" | "desc";
  onSort: (field: UserSortField) => void;
  /** Only a MASTER may change roles - the server enforces this too. */
  canChangeRole: boolean;
  currentUserId?: string;
  busyUserId: string | null;
  onBan: (user: AdminUser) => void;
  onUnban: (user: AdminUser) => void;
  onChangeRole: (user: AdminUser, role: UserRole) => void;
  /** Opens the edit panel for this account. */
  onOpen: (user: AdminUser) => void;
}) {
  const allSelected = users.length > 0 && users.every((u) => selected.has(u.id));

  const toggleAll = (checked: boolean) => {
    const next = new Set(selected);
    for (const user of users) {
      if (checked) next.add(user.id);
      else next.delete(user.id);
    }
    onSelectedChange(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    onSelectedChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-[rgba(9,14,28,0.6)]">
            <th className="w-10 px-4 py-2.5">
              <Checkbox
                checked={allSelected}
                onChange={toggleAll}
                label={<span className="sr-only">Select all users on this page</span>}
              />
            </th>
            <SortableHeader
              label="User"
              field="username"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-3 py-2.5 text-left eyebrow">Role</th>
            <th className="px-3 py-2.5 text-left eyebrow">Status</th>
            <SortableHeader
              label="Rating"
              field="rating"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-3 py-2.5 text-left eyebrow">Location</th>
            <SortableHeader
              label="Joined At"
              field="createdAt"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableHeader
              label="Last Active"
              field="lastActiveAt"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="w-20 px-4 py-2.5 text-right eyebrow">Actions</th>
          </tr>
        </thead>

        <tbody>
          {loading && users.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-14 text-center">
                <span className="inline-flex items-center gap-2 text-[13px] text-dim">
                  <IconSpinner size={15} />
                  Loading users…
                </span>
              </td>
            </tr>
          ) : users.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-14 text-center text-[13px] text-dim">
                No users match these filters.
              </td>
            </tr>
          ) : (
            users.map((user) => {
              const tone = activityTone(user.lastActiveAt);
              const isSelf = user.id === currentUserId;
              return (
                <tr
                  key={user.id}
                  className={cx(
                    "border-b border-line-soft transition-colors last:border-b-0 hover:bg-panel-2/40",
                    busyUserId === user.id && "opacity-60",
                  )}
                >
                  <td className="px-4 py-2.5">
                    <Checkbox
                      checked={selected.has(user.id)}
                      onChange={(checked) => toggleOne(user.id, checked)}
                      label={
                        <span className="sr-only">Select {user.username}</span>
                      }
                    />
                  </td>

                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cx(
                          "grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white",
                          avatarGradient(user.username),
                        )}
                        aria-hidden="true"
                      >
                        {initials(user.username)}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpen(user)}
                            className="truncate text-left text-[13px] font-semibold text-fg transition-colors hover:text-blue-soft hover:underline"
                          >
                            {user.username}
                          </button>
                          {isSelf ? <Badge tone="teal">You</Badge> : null}
                        </span>
                        <span className="block truncate text-[11.5px] text-dim">
                          {user.email}
                        </span>
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-2.5">
                    <Badge tone={ROLE_TONE[user.role]}>{user.role}</Badge>
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px]">
                      <span
                        className={cx(
                          "size-1.5 rounded-full",
                          user.status === "ACTIVE" ? "bg-green" : "bg-rose",
                        )}
                      />
                      <span
                        className={
                          user.status === "ACTIVE" ? "text-emerald-300" : "text-rose-300"
                        }
                      >
                        {user.status === "ACTIVE" ? "Active" : "Banned"}
                      </span>
                    </span>
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                      <IconAnalytics size={13} className="text-dim" />
                      {user.rating === null ? (
                        <span className="text-dim">—</span>
                      ) : (
                        formatNumber(user.rating)
                      )}
                    </span>
                  </td>

                  <td className="px-3 py-2.5 text-[12.5px] text-muted">
                    {[user.city, user.country].filter(Boolean).join(", ") || (
                      <span className="text-dim">—</span>
                    )}
                  </td>

                  <td className="px-3 py-2.5 text-[12.5px] text-muted">
                    {formatDate(user.createdAt)}
                  </td>

                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
                      <span
                        className={cx("size-1.5 rounded-full", ACTIVITY_DOT[tone])}
                      />
                      {formatRelative(user.lastActiveAt)}
                    </span>
                  </td>

                  <td className="px-4 py-2.5 text-right">
                    <RowActions
                      user={user}
                      isSelf={isSelf}
                      busy={busyUserId === user.id}
                      canChangeRole={canChangeRole}
                      onBan={() => onBan(user)}
                      onUnban={() => onUnban(user)}
                      onChangeRole={(role) => onChangeRole(user, role)}
                      onEdit={() => onOpen(user)}
                    />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string;
  field: UserSortField;
  sortBy: UserSortField;
  sortDir: "asc" | "desc";
  onSort: (field: UserSortField) => void;
}) {
  const active = sortBy === field;
  return (
    // aria-sort belongs on the column header, not on the button inside it.
    <th
      className="px-3 py-2.5 text-left"
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cx(
          "eyebrow inline-flex items-center gap-1 transition-colors hover:text-fg",
          active && "text-fg",
        )}
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <IconChevronUp size={12} />
          ) : (
            <IconChevronDown size={12} />
          )
        ) : null}
      </button>
    </th>
  );
}

function RowActions({
  user,
  isSelf,
  busy,
  canChangeRole,
  onBan,
  onUnban,
  onChangeRole,
  onEdit,
}: {
  user: AdminUser;
  isSelf: boolean;
  busy: boolean;
  canChangeRole: boolean;
  onBan: () => void;
  onUnban: () => void;
  onChangeRole: (role: UserRole) => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // MASTER accounts cannot be banned by anyone, and nobody moderates
  // themselves. The server enforces both; this only hides options that would
  // certainly be refused.
  const canModerate = !isSelf && user.role !== "MASTER";

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        aria-label={`Actions for ${user.username}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((value) => !value)}
        className="grid size-7 place-items-center rounded-[7px] border border-line text-dim transition-colors hover:border-panel-3 hover:text-fg disabled:opacity-40"
      >
        {busy ? <IconSpinner size={13} /> : <span className="tracking-widest">···</span>}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="panel absolute right-0 z-20 mt-1.5 w-52 overflow-hidden p-1.5 text-left"
          >
            <MenuItem
              icon={<IconPencil size={14} />}
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
            >
              Edit user
            </MenuItem>
            <MenuItem
              icon={<IconCopy size={14} />}
              onClick={() => {
                void navigator.clipboard?.writeText(user.id);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Copied" : "Copy user ID"}
            </MenuItem>

            {canChangeRole && !isSelf ? (
              <>
                <div className="my-1 h-px bg-line" />
                <p className="px-2.5 py-1 eyebrow">Change role</p>
                {(["USER", "ADMIN", "MASTER"] as UserRole[])
                  .filter((role) => role !== user.role)
                  .map((role) => (
                    <MenuItem
                      key={role}
                      icon={<IconShieldCheck size={14} />}
                      onClick={() => {
                        setOpen(false);
                        onChangeRole(role);
                      }}
                    >
                      Make {role}
                    </MenuItem>
                  ))}
              </>
            ) : null}

            {canModerate ? (
              <>
                <div className="my-1 h-px bg-line" />
                {user.status === "ACTIVE" ? (
                  <MenuItem
                    icon={<IconBan size={14} />}
                    danger
                    onClick={() => {
                      setOpen(false);
                      onBan();
                    }}
                  >
                    Ban user
                  </MenuItem>
                ) : (
                  <MenuItem
                    icon={<IconShieldCheck size={14} />}
                    onClick={() => {
                      setOpen(false);
                      onUnban();
                    }}
                  >
                    Lift ban
                  </MenuItem>
                )}
              </>
            ) : (
              <p className="px-2.5 py-1.5 text-[11px] leading-4 text-dim">
                {isSelf
                  ? "You cannot moderate your own account."
                  : "MASTER accounts cannot be banned."}
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors",
        danger
          ? "text-rose-300 hover:bg-rose/12"
          : "text-muted hover:bg-panel-2 hover:text-fg",
      )}
    >
      {icon}
      {children}
    </button>
  );
}
