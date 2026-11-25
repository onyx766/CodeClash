"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ApiError } from "../../lib/api";
import { userService } from "../../services/user.service";
import { useRequireAdmin } from "../../hooks/useAdminAuth";
import { AdminShell } from "../../components/layout/AdminShell";
import { Button, Card, Notice } from "../../components/ui/Primitives";
import { IconSpinner, IconUserPlus, IconUsers } from "../../components/ui/Icons";
import { UserStatCards } from "../../components/users/UserStatCards";
import { UserFilters } from "../../components/users/UserFilters";
import { UsersTable } from "../../components/users/UsersTable";
import { TablePagination } from "../../components/users/TablePagination";
import {
  AddUserDialog,
  BanUserDialog,
} from "../../components/users/UserDialogs";
import { UserEditDrawer } from "../../components/users/UserEditDrawer";
import type {
  AdminUser,
  CreateUserPayload,
  ListUsersQuery,
  Pagination,
  UserRole,
  UserSortField,
  UserStats,
} from "../../lib/types";

const PAGE_SIZE = 20;

function UsersPageInner() {
  const { user, loading: authLoading, isAdmin } = useRequireAdmin();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? "";

  const [filters, setFilters] = useState<ListUsersQuery>({
    // Seeded from ?search= so the topbar search lands here with a query.
    search: urlSearch,
  });
  const [page, setPage] = useState(1);

  // A later topbar search changes ?search= while this page stays mounted;
  // follow it and start again from the first page.
  const [syncedSearch, setSyncedSearch] = useState(urlSearch);
  if (urlSearch !== syncedSearch) {
    setSyncedSearch(urlSearch);
    setFilters((current) => ({ ...current, search: urlSearch }));
    setPage(1);
  }
  const [sortBy, setSortBy] = useState<UserSortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [stats, setStats] = useState<UserStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    tone: "green" | "rose";
    message: string;
  } | null>(null);

  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Discards a response that is no longer the newest request in flight.
  const requestId = useRef(0);

  const describe = (caught: unknown) =>
    caught instanceof ApiError ? caught.message : "Something went wrong.";

  const loadUsers = useCallback(async () => {
    const ticket = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await userService.list({
        ...filters,
        search: filters.search?.trim() || undefined,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortDir,
      });
      if (ticket !== requestId.current) return;
      setUsers(response.users);
      setPagination(response.pagination);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setError(describe(caught));
      setUsers([]);
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, [filters, page, sortBy, sortDir]);

  /**
   * Background refresh used after a mutation. Deliberately does not toggle the
   * loading flag - the cards keep their current numbers until the new ones
   * arrive, instead of flashing back to placeholders.
   */
  const loadStats = useCallback(async () => {
    try {
      const response = await userService.stats();
      setStats(response.stats);
    } catch {
      // Leaves the previous figures on screen; the table is the source of truth.
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    // Debounced so typing in the search box does not fire a request per keystroke.
    const timer = setTimeout(() => void loadUsers(), filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [isAdmin, loadUsers, filters.search]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    // State is set from the promise callbacks only, never synchronously here.
    userService
      .stats()
      .then((response) => {
        if (cancelled) return;
        setStats(response.stats);
        setStatsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
        setStatsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const patchFilters = (next: Partial<ListUsersQuery>) => {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  };

  const resetFilters = () => {
    setFilters({ search: "" });
    setPage(1);
  };

  const toggleSort = (field: UserSortField) => {
    if (field === sortBy) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "username" ? "asc" : "desc");
    }
    setPage(1);
  };

  /** Applies a server response for one user in place, without a full refetch. */
  const applyUser = (updated: AdminUser) => {
    setUsers((current) =>
      current.map((row) => (row.id === updated.id ? updated : row)),
    );
    void loadStats();
  };

  const handleBan = async (reason: string) => {
    if (!banTarget) return;
    setSubmitting(true);
    setDialogError(null);
    try {
      const response = await userService.ban(banTarget.id, reason || undefined);
      applyUser(response.user);
      setNotice({ tone: "green", message: `${banTarget.username} has been banned.` });
      setBanTarget(null);
    } catch (caught) {
      setDialogError(describe(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnban = async (target: AdminUser) => {
    setBusyUserId(target.id);
    try {
      const response = await userService.unban(target.id);
      applyUser(response.user);
      setNotice({ tone: "green", message: `Ban lifted for ${target.username}.` });
    } catch (caught) {
      setNotice({ tone: "rose", message: describe(caught) });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleChangeRole = async (target: AdminUser, role: UserRole) => {
    setBusyUserId(target.id);
    try {
      await userService.changeRole(target.id, role);
      // The role endpoint returns a narrower shape than the table row, so the
      // row is refreshed from the list endpoint instead of being patched.
      const refreshed = await userService.get(target.id);
      applyUser(refreshed.user);
      setNotice({
        tone: "green",
        message: `${target.username} is now ${role}.`,
      });
    } catch (caught) {
      setNotice({ tone: "rose", message: describe(caught) });
    } finally {
      setBusyUserId(null);
    }
  };

  const handleCreate = async (payload: CreateUserPayload) => {
    setSubmitting(true);
    setDialogError(null);
    try {
      const response = await userService.create(payload);
      setAddOpen(false);
      setNotice({
        tone: "green",
        message: `${response.user.username} created.`,
      });
      await Promise.all([loadUsers(), loadStats()]);
    } catch (caught) {
      setDialogError(describe(caught));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !isAdmin) {
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
    <AdminShell breadcrumbs={[{ label: "Users" }]}>
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-blue/25 bg-gradient-to-br from-blue/25 to-violet/10 text-blue-soft">
              <IconUsers size={20} />
            </span>
            <div>
              <p className="eyebrow">User Management</p>
              <h1 className="mt-1 text-[26px] leading-tight font-bold tracking-tight">
                Users
              </h1>
              <p className="mt-0.5 text-[13px] text-muted">
                Manage user accounts, roles, status, and activity.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            icon={<IconUserPlus size={16} />}
            onClick={() => {
              setDialogError(null);
              setAddOpen(true);
            }}
          >
            Add User
          </Button>
        </div>

        {notice ? (
          <div className="mt-4">
            <Notice tone={notice.tone}>{notice.message}</Notice>
          </div>
        ) : null}

        <div className="mt-5">
          <UserStatCards stats={stats} loading={statsLoading} />
        </div>

        {error ? (
          <div className="mt-4">
            <Notice tone="rose">{error}</Notice>
          </div>
        ) : null}

        <Card className="mt-4 overflow-hidden">
          <UserFilters
            filters={filters}
            onChange={patchFilters}
            onReset={resetFilters}
          />

          <UsersTable
            users={users}
            loading={loading}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={toggleSort}
            canChangeRole={user?.role === "MASTER"}
            currentUserId={user?.id}
            busyUserId={busyUserId}
            onBan={(target) => {
              setDialogError(null);
              setBanTarget(target);
            }}
            onUnban={handleUnban}
            onChangeRole={handleChangeRole}
            onOpen={(target) => setEditingId(target.id)}
          />

          <TablePagination pagination={pagination} onPageChange={setPage} />
        </Card>
      </div>

      {editingId && user ? (
        <UserEditDrawer
          userId={editingId}
          actor={user}
          onClose={() => setEditingId(null)}
          onUserChanged={applyUser}
        />
      ) : null}

      {banTarget ? (
        <BanUserDialog
          user={banTarget}
          submitting={submitting}
          error={dialogError}
          onCancel={() => setBanTarget(null)}
          onConfirm={handleBan}
        />
      ) : null}

      {addOpen ? (
        <AddUserDialog
          canAssignRoles={user?.role === "MASTER"}
          submitting={submitting}
          error={dialogError}
          onCancel={() => setAddOpen(false)}
          onSubmit={handleCreate}
        />
      ) : null}
    </AdminShell>
  );
}

export default function UsersPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center">
          <IconSpinner size={18} />
        </div>
      }
    >
      <UsersPageInner />
    </Suspense>
  );
}
