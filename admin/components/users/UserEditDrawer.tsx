"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError } from "../../lib/api";
import { userService } from "../../services/user.service";
import {
  Badge,
  Button,
  Field,
  Notice,
  Select,
  TextArea,
  TextInput,
  cx,
} from "../ui/Primitives";
import {
  IconAlert,
  IconBan,
  IconCopy,
  IconLock,
  IconSave,
  IconShieldCheck,
  IconSpinner,
} from "../ui/Icons";
import {
  avatarGradient,
  formatDate,
  formatNumber,
  formatRelative,
  initials,
} from "../../lib/format";
import type {
  AdminUpdateUserPayload,
  AdminUserDetail,
  AuthUser,
  UserRole,
} from "../../lib/types";

const RANK: Record<UserRole, number> = { USER: 1, ADMIN: 2, MASTER: 3 };

interface DetailsForm {
  username: string;
  email: string;
  displayName: string;
  location: string;
  avatarUrl: string;
  bio: string;
  country: string;
  region: string;
  city: string;
}

function formFrom(user: AdminUserDetail): DetailsForm {
  return {
    username: user.username,
    email: user.email,
    displayName: user.profile.displayName ?? "",
    location: user.profile.location ?? "",
    avatarUrl: user.profile.avatarUrl ?? "",
    bio: user.profile.bio ?? "",
    country: user.country ?? "",
    region: user.region ?? "",
    city: user.city ?? "",
  };
}

/**
 * Slide-over editor for one account.
 *
 * What it offers mirrors what the server will accept for this actor/target
 * pair - it never offers an action that would certainly be refused, and the
 * server re-checks every one of them anyway:
 *
 *  - details (username, email, profile): your own account, or one you outrank
 *  - ban / lift ban, reset password: only accounts you strictly outrank
 *  - role: MASTER only, never your own
 *
 * Competitive stats are shown read-only. They come from match results;
 * editing them by hand would bypass the rating anti-rigging rules.
 */
export function UserEditDrawer({
  userId,
  actor,
  onClose,
  onUserChanged,
}: {
  userId: string;
  actor: AuthUser;
  onClose: () => void;
  onUserChanged: (user: AdminUserDetail) => void;
}) {
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<DetailsForm | null>(null);

  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState<Message | null>(null);

  const [roleDraft, setRoleDraft] = useState<UserRole>("USER");
  const [savingRole, setSavingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<Message | null>(null);

  const [banReason, setBanReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState<Message | null>(null);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<Message | null>(null);

  const [copied, setCopied] = useState(false);

  const describe = (caught: unknown) =>
    caught instanceof ApiError ? caught.message : "Something went wrong.";

  /** Server response is the single source of truth after every change. */
  const adopt = useCallback(
    (next: AdminUserDetail) => {
      setUser(next);
      setForm(formFrom(next));
      setRoleDraft(next.role);
      onUserChanged(next);
    },
    [onUserChanged],
  );

  useEffect(() => {
    let cancelled = false;
    userService
      .get(userId)
      .then((response) => {
        if (cancelled) return;
        setUser(response.user);
        setForm(formFrom(response.user));
        setRoleDraft(response.user.role);
      })
      .catch((caught) => {
        if (!cancelled) setLoadError(describe(caught));
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const changes = useMemo<AdminUpdateUserPayload>(() => {
    if (!user || !form) return {};
    const original = formFrom(user);
    const diff: AdminUpdateUserPayload = {};
    (Object.keys(form) as (keyof DetailsForm)[]).forEach((key) => {
      const value = key === "email" ? form[key].trim().toLowerCase() : form[key].trim();
      if (value !== original[key]) diff[key] = value;
    });
    return diff;
  }, [user, form]);

  const dirty = Object.keys(changes).length > 0;

  const requestClose = useCallback(() => {
    if (dirty && !window.confirm("Discard your unsaved changes to this account?")) {
      return;
    }
    onClose();
  }, [dirty, onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // ---------------------------------------------------------------------------

  const isSelf = user?.id === actor.id;
  const outranks = user ? RANK[actor.role] > RANK[user.role] : false;
  const canEditDetails = !!user && (isSelf || outranks);
  const canModerate = !!user && !isSelf && outranks;
  const canChangeRole = !!user && actor.role === "MASTER" && !isSelf;

  const detailsError = (() => {
    if (!form) return null;
    if (form.username.trim().length < 3 || form.username.trim().length > 30) {
      return "Username must be 3–30 characters.";
    }
    if (!/\S+@\S+\.\S+/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.avatarUrl.trim() && !/^https?:\/\/\S+$/i.test(form.avatarUrl.trim())) {
      return "Avatar URL must start with http:// or https://.";
    }
    return null;
  })();

  const saveDetails = async () => {
    if (!user || !dirty || detailsError) return;
    setSavingDetails(true);
    setDetailsMessage(null);
    try {
      const response = await userService.update(user.id, changes);
      adopt(response.user);
      setDetailsMessage({ tone: "green", text: "Changes saved." });
    } catch (caught) {
      setDetailsMessage({ tone: "rose", text: describe(caught) });
    } finally {
      setSavingDetails(false);
    }
  };

  const applyRole = async () => {
    if (!user || roleDraft === user.role) return;
    setSavingRole(true);
    setRoleMessage(null);
    try {
      await userService.changeRole(user.id, roleDraft);
      adopt((await userService.get(user.id)).user);
      setRoleMessage({ tone: "green", text: `Role changed to ${roleDraft}.` });
    } catch (caught) {
      setRoleDraft(user.role);
      setRoleMessage({ tone: "rose", text: describe(caught) });
    } finally {
      setSavingRole(false);
    }
  };

  const toggleBan = async () => {
    if (!user) return;
    setSavingStatus(true);
    setStatusMessage(null);
    try {
      if (user.status === "ACTIVE") {
        await userService.ban(user.id, banReason.trim() || undefined);
        setBanReason("");
        setStatusMessage({ tone: "green", text: "Account banned and signed out." });
      } else {
        await userService.unban(user.id);
        setStatusMessage({ tone: "green", text: "Ban lifted." });
      }
      adopt((await userService.get(user.id)).user);
    } catch (caught) {
      setStatusMessage({ tone: "rose", text: describe(caught) });
    } finally {
      setSavingStatus(false);
    }
  };

  const passwordError =
    password && password.length < 8
      ? "At least 8 characters."
      : passwordConfirm && password !== passwordConfirm
        ? "Passwords do not match."
        : null;

  const resetPassword = async () => {
    if (!user || passwordError || password.length < 8 || password !== passwordConfirm) {
      return;
    }
    setSavingPassword(true);
    setPasswordMessage(null);
    try {
      await userService.resetPassword(user.id, password);
      setPassword("");
      setPasswordConfirm("");
      adopt((await userService.get(user.id)).user);
      setPasswordMessage({
        tone: "green",
        text: "Password reset. The account has been signed out of every session.",
      });
    } catch (caught) {
      setPasswordMessage({ tone: "rose", text: describe(caught) });
    } finally {
      setSavingPassword(false);
    }
  };

  // ---------------------------------------------------------------------------

  return (
    <div role="dialog" aria-modal="true" aria-label="Edit user" className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
        onClick={requestClose}
      />

      <aside className="absolute inset-y-0 right-0 flex w-full max-w-[520px] flex-col border-l border-line bg-surface shadow-[0_0_80px_-20px_rgba(0,0,0,0.9)]">
        {/* ---------------- header ---------------- */}
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {user ? (
            <span
              className={cx(
                "grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br text-[13px] font-bold text-white",
                avatarGradient(user.username),
              )}
              aria-hidden="true"
            >
              {initials(user.username)}
            </span>
          ) : (
            <span className="size-11 shrink-0 rounded-full bg-panel-2" />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="truncate text-[16px] font-semibold">
                {user?.username ?? "Loading…"}
              </h2>
              {user ? (
                <>
                  <Badge
                    tone={
                      user.role === "MASTER"
                        ? "violet"
                        : user.role === "ADMIN"
                          ? "blue"
                          : "neutral"
                    }
                  >
                    {user.role}
                  </Badge>
                  <Badge tone={user.status === "ACTIVE" ? "green" : "rose"}>
                    {user.status === "ACTIVE" ? "Active" : "Banned"}
                  </Badge>
                  {isSelf ? <Badge tone="teal">You</Badge> : null}
                </>
              ) : null}
            </div>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(user.id);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="mono mt-1 inline-flex items-center gap-1 text-[10.5px] text-dim transition-colors hover:text-fg"
              >
                <IconCopy size={11} />
                {copied ? "Copied" : user.id}
              </button>
            ) : null}
          </div>

          <Button size="sm" variant="ghost" onClick={requestClose}>
            Close
          </Button>
        </header>

        {/* ---------------- body ---------------- */}
        <div className="flex-1 overflow-y-auto">
          {loadError ? (
            <div className="p-5">
              <Notice tone="rose">{loadError}</Notice>
            </div>
          ) : !user || !form ? (
            <div className="grid h-40 place-items-center">
              <span className="flex items-center gap-2 text-[13px] text-dim">
                <IconSpinner size={15} />
                Loading account…
              </span>
            </div>
          ) : (
            <div className="space-y-4 p-5">
              {/* overview */}
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Fact label="Joined">{formatDate(user.createdAt)}</Fact>
                <Fact label="Last active">{formatRelative(user.lastActiveAt)}</Fact>
              </dl>

              {/* details */}
              <Section
                title="Account & profile"
                description={
                  canEditDetails
                    ? "Only the fields you change are sent."
                    : "You can only edit your own account or accounts ranked below yours."
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Username" htmlFor="edit-username">
                    <TextInput
                      id="edit-username"
                      value={form.username}
                      maxLength={30}
                      disabled={!canEditDetails}
                      onChange={(event) =>
                        setForm({ ...form, username: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Email" htmlFor="edit-email">
                    <TextInput
                      id="edit-email"
                      type="email"
                      value={form.email}
                      disabled={!canEditDetails}
                      onChange={(event) =>
                        setForm({ ...form, email: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Display name" htmlFor="edit-display-name">
                    <TextInput
                      id="edit-display-name"
                      value={form.displayName}
                      maxLength={50}
                      disabled={!canEditDetails}
                      placeholder="Not set"
                      onChange={(event) =>
                        setForm({ ...form, displayName: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Location" htmlFor="edit-location">
                    <TextInput
                      id="edit-location"
                      value={form.location}
                      maxLength={100}
                      disabled={!canEditDetails}
                      placeholder="Not set"
                      onChange={(event) =>
                        setForm({ ...form, location: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Country" htmlFor="edit-country">
                    <TextInput
                      id="edit-country"
                      value={form.country}
                      maxLength={100}
                      disabled={!canEditDetails}
                      placeholder="Not set"
                      onChange={(event) =>
                        setForm({ ...form, country: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Region" htmlFor="edit-region">
                    <TextInput
                      id="edit-region"
                      value={form.region}
                      maxLength={100}
                      disabled={!canEditDetails}
                      placeholder="Not set"
                      onChange={(event) =>
                        setForm({ ...form, region: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="City" htmlFor="edit-city">
                    <TextInput
                      id="edit-city"
                      value={form.city}
                      maxLength={100}
                      disabled={!canEditDetails}
                      placeholder="Not set"
                      onChange={(event) =>
                        setForm({ ...form, city: event.target.value })
                      }
                    />
                  </Field>
                </div>

                <Field label="Avatar URL" htmlFor="edit-avatar" className="mt-3">
                  <TextInput
                    id="edit-avatar"
                    value={form.avatarUrl}
                    maxLength={500}
                    disabled={!canEditDetails}
                    placeholder="https://…"
                    onChange={(event) =>
                      setForm({ ...form, avatarUrl: event.target.value })
                    }
                  />
                </Field>

                <Field label="Bio" htmlFor="edit-bio" className="mt-3">
                  <TextArea
                    id="edit-bio"
                    rows={3}
                    value={form.bio}
                    maxLength={300}
                    disabled={!canEditDetails}
                    placeholder="Not set"
                    onChange={(event) => setForm({ ...form, bio: event.target.value })}
                  />
                </Field>

                {canEditDetails ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<IconSave size={14} />}
                      loading={savingDetails}
                      disabled={!dirty || !!detailsError}
                      onClick={saveDetails}
                    >
                      Save changes
                    </Button>
                    {dirty ? (
                      <Button size="sm" variant="ghost" onClick={() => setForm(formFrom(user))}>
                        Discard
                      </Button>
                    ) : null}
                    {dirty && detailsError ? (
                      <span className="text-[11.5px] text-rose-300">{detailsError}</span>
                    ) : null}
                  </div>
                ) : null}
                <MessageLine message={detailsMessage} />
              </Section>

              {/* role */}
              <Section
                title="Role"
                description={
                  canChangeRole
                    ? "Changes what this account can do across CodeClash."
                    : isSelf
                      ? "You cannot change your own role."
                      : "Only a MASTER can change roles."
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    aria-label="Role"
                    className="h-9 w-[160px]"
                    value={roleDraft}
                    disabled={!canChangeRole || savingRole}
                    onChange={(event) => setRoleDraft(event.target.value as UserRole)}
                  >
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MASTER">Master</option>
                  </Select>
                  {canChangeRole ? (
                    <Button
                      size="sm"
                      icon={<IconShieldCheck size={14} />}
                      loading={savingRole}
                      disabled={roleDraft === user.role}
                      onClick={applyRole}
                    >
                      Apply role
                    </Button>
                  ) : null}
                </div>
                {canChangeRole && roleDraft === "MASTER" && user.role !== "MASTER" ? (
                  <p className="mt-2 text-[11.5px] text-amber-300">
                    A MASTER can change any role, and cannot be banned by anyone.
                  </p>
                ) : null}
                <MessageLine message={roleMessage} />
              </Section>

              {/* status */}
              <Section
                title="Account status"
                description={
                  canModerate
                    ? user.status === "ACTIVE"
                      ? "Banning signs the account out and refuses every sign-in."
                      : `Banned ${formatRelative(user.bannedAt)}.`
                    : isSelf
                      ? "You cannot ban your own account."
                      : "You can only ban accounts ranked below yours."
                }
              >
                {user.status === "BANNED" && user.banReason ? (
                  <p className="mb-2 rounded-[8px] border border-rose/25 bg-rose/8 px-3 py-2 text-[12px] text-rose-200">
                    Reason: {user.banReason}
                  </p>
                ) : null}

                {canModerate ? (
                  user.status === "ACTIVE" ? (
                    <div className="space-y-2">
                      <TextArea
                        aria-label="Ban reason"
                        rows={2}
                        maxLength={500}
                        value={banReason}
                        placeholder="Reason (optional, shown to the account)"
                        onChange={(event) => setBanReason(event.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<IconBan size={14} />}
                        loading={savingStatus}
                        onClick={toggleBan}
                      >
                        Ban account
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      icon={<IconShieldCheck size={14} />}
                      loading={savingStatus}
                      onClick={toggleBan}
                    >
                      Lift ban
                    </Button>
                  )
                ) : null}
                <MessageLine message={statusMessage} />
              </Section>

              {/* security */}
              <Section
                title="Password"
                description={
                  canModerate
                    ? "Sets a new password and ends every session the account has open."
                    : isSelf
                      ? "Change your own password from your profile, not here."
                      : "You can only reset passwords for accounts ranked below yours."
                }
              >
                {canModerate ? (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <TextInput
                        type="password"
                        aria-label="New password"
                        autoComplete="new-password"
                        placeholder="New password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <TextInput
                        type="password"
                        aria-label="Confirm new password"
                        autoComplete="new-password"
                        placeholder="Confirm password"
                        value={passwordConfirm}
                        onChange={(event) => setPasswordConfirm(event.target.value)}
                      />
                    </div>
                    {passwordError ? (
                      <p className="text-[11.5px] text-rose-300">{passwordError}</p>
                    ) : null}
                    <Button
                      size="sm"
                      icon={<IconLock size={14} />}
                      loading={savingPassword}
                      disabled={
                        !password || password.length < 8 || password !== passwordConfirm
                      }
                      onClick={resetPassword}
                    >
                      Reset password &amp; sign out
                    </Button>
                  </div>
                ) : null}
                {user.sessionsRevokedAt ? (
                  <p className="mt-2 text-[11px] text-dim">
                    Sessions last revoked {formatRelative(user.sessionsRevokedAt)}.
                  </p>
                ) : null}
                <MessageLine message={passwordMessage} />
              </Section>

              {/* stats */}
              <Section
                title="Competitive stats"
                description="Derived from match results, so read-only — editing them would bypass the rating rules."
              >
                {user.stats ? (
                  <dl className="grid grid-cols-3 gap-2">
                    <Fact label="Rating">{formatNumber(user.stats.rating)}</Fact>
                    <Fact label="Matches">{formatNumber(user.stats.matchesPlayed)}</Fact>
                    <Fact label="W / L">
                      {user.stats.wins} / {user.stats.losses}
                    </Fact>
                    <Fact label="Best streak">{user.stats.bestStreak}</Fact>
                    <Fact label="Solved">{formatNumber(user.stats.challengesSolved)}</Fact>
                    <Fact label="Coins · XP">
                      {formatNumber(user.stats.coins)} · {formatNumber(user.stats.xp)}
                    </Fact>
                  </dl>
                ) : (
                  <p className="text-[12px] text-dim">This account has no stats yet.</p>
                )}
              </Section>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

type Message = { tone: "green" | "rose"; text: string };

function MessageLine({ message }: { message: Message | null }) {
  if (!message) return null;
  return (
    <p
      role={message.tone === "rose" ? "alert" : "status"}
      className={cx(
        "mt-2 flex items-start gap-1.5 text-[11.5px]",
        message.tone === "green" ? "text-emerald-300" : "text-rose-300",
      )}
    >
      {message.tone === "rose" ? <IconAlert size={13} className="mt-px shrink-0" /> : null}
      {message.text}
    </p>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-panel/60 p-4">
      <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
      <p className="mt-0.5 mb-3 text-[11.5px] leading-4 text-dim">{description}</p>
      {children}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-[9px] border border-line bg-panel-2/50 px-3 py-2">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 truncate text-[12.5px] font-semibold text-fg">{children}</dd>
    </div>
  );
}
