"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Button,
  Field,
  Notice,
  Select,
  TextArea,
  TextInput,
} from "../ui/Primitives";
import { IconAlert, IconBan, IconUserPlus } from "../ui/Icons";
import type { AdminUser, CreateUserPayload, UserRole } from "../../lib/types";

function Modal({
  title,
  description,
  icon,
  onClose,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="fixed inset-0 -z-10 cursor-default"
        onClick={onClose}
      />
      <div className="panel w-full max-w-md overflow-hidden">
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          {icon}
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <p className="mt-0.5 text-[12px] text-dim">{description}</p>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

/**
 * Ban confirmation. The reason is optional but is stored on the record and
 * shown to the account when it next tries to sign in.
 */
export function BanUserDialog({
  user,
  submitting,
  error,
  onCancel,
  onConfirm,
}: {
  user: AdminUser;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");

  return (
    <Modal
      title={`Ban ${user.username}?`}
      description="They will be signed out and refused access immediately."
      icon={
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-rose/30 bg-rose/12 text-rose-300">
          <IconBan size={17} />
        </span>
      }
      onClose={onCancel}
    >
      <div className="space-y-4 p-5">
        {error ? (
          <Notice tone="rose">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {error}
            </span>
          </Notice>
        ) : null}

        <div className="rounded-[10px] border border-line bg-panel-2/50 px-3 py-2.5">
          <p className="text-[12.5px] font-semibold text-fg">{user.username}</p>
          <p className="text-[11.5px] text-dim">{user.email}</p>
        </div>

        <Field
          label="Reason"
          htmlFor="ban-reason"
          hint="Optional. Shown to the account on their next sign-in attempt."
        >
          <TextArea
            id="ban-reason"
            rows={3}
            maxLength={500}
            value={reason}
            placeholder="Repeated submission of plagiarised solutions"
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            variant="danger"
            loading={submitting}
            icon={<IconBan size={15} />}
            onClick={() => onConfirm(reason.trim())}
          >
            Ban user
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Admin-created account. Role is limited to USER unless the signed-in admin is
 * a MASTER - and the server independently refuses anything else.
 */
export function AddUserDialog({
  canAssignRoles,
  submitting,
  error,
  onCancel,
  onSubmit,
}: {
  canAssignRoles: boolean;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (payload: CreateUserPayload) => void;
}) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("USER");

  const valid =
    /\S+@\S+\.\S+/.test(email) && username.trim().length >= 3 && password.length >= 8;

  return (
    <Modal
      title="Add user"
      description="Creates an account immediately, with the password you set here."
      icon={
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-blue/30 bg-blue/12 text-blue-soft">
          <IconUserPlus size={17} />
        </span>
      }
      onClose={onCancel}
    >
      <form
        className="space-y-4 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({
            email: email.trim().toLowerCase(),
            username: username.trim(),
            password,
            role: canAssignRoles ? role : undefined,
          });
        }}
      >
        {error ? (
          <Notice tone="rose">
            <span className="flex items-start gap-2">
              <IconAlert size={15} className="mt-px shrink-0" />
              {error}
            </span>
          </Notice>
        ) : null}

        <Field label="Email" required htmlFor="new-email">
          <TextInput
            id="new-email"
            type="email"
            autoComplete="off"
            value={email}
            placeholder="player@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field
          label="Username"
          required
          htmlFor="new-username"
          hint="3–30 characters, unique across the platform."
        >
          <TextInput
            id="new-username"
            autoComplete="off"
            value={username}
            maxLength={30}
            placeholder="new_player"
            onChange={(event) => setUsername(event.target.value)}
          />
        </Field>

        <Field
          label="Temporary password"
          required
          htmlFor="new-password"
          hint="At least 8 characters. Share it with the account owner securely."
        >
          <TextInput
            id="new-password"
            type="text"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <Field
          label="Role"
          htmlFor="new-role"
          hint={
            canAssignRoles
              ? "Only a MASTER can create ADMIN or MASTER accounts."
              : "New accounts you create are always USER. Ask a MASTER to grant a higher role."
          }
        >
          <Select
            id="new-role"
            value={role}
            disabled={!canAssignRoles}
            onChange={(event) => setRole(event.target.value as UserRole)}
          >
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
            <option value="MASTER">Master</option>
          </Select>
        </Field>

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={submitting}
            disabled={!valid}
          >
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}
