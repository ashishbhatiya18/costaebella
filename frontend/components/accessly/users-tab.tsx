"use client";

import { useState } from "react";
import { useAuth } from "@/lib/admin/auth-context";
import { api, ROLE_OPTIONS, User } from "@/lib/accessly/api";
import { Button } from "@/components/admin/ui/button";
import { Card } from "@/components/admin/ui/card";
import { Modal } from "@/components/admin/ui/modal";
import { IconButton } from "@/components/admin/ui/icon-button";
import { TrashIcon } from "@/components/admin/ui/icons";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { UserForm, UserFormValue } from "@/components/accessly/user-form";

export function UsersTab({
  users,
  loading,
  onChange,
}: {
  users: User[];
  loading: boolean;
  onChange: () => Promise<void>;
}) {
  const { email: selfEmail } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCreate(value: UserFormValue) {
    await api.createUser(value);
    setModalOpen(false);
    await onChange();
  }

  async function handleRoleChange(user: User, role: User["role"]) {
    if (!role) return;
    setBusyId(user.id);
    try {
      await api.updateUserRole(user.id, role);
      await onChange();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Remove ${user.email}? This revokes their login access entirely.`)) return;
    setBusyId(user.id);
    try {
      await api.deleteUser(user.id);
      await onChange();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-navy/60">
          Everyone with sign-in access to /admin, and the role that governs which apps they can use.
        </p>
        <Button onClick={() => setModalOpen(true)}>+ Add user</Button>
      </div>

      {loading ? (
        <p className="text-sm text-navy/60">Loading…</p>
      ) : users.length === 0 ? (
        <Card className="p-10 text-center text-navy/50">No users yet.</Card>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const isSelf = u.email === selfEmail;
            const busy = busyId === u.id;
            return (
              <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-navy">
                    {u.email}
                    {isSelf && <span className="ml-2 text-xs font-normal text-navy/40">(you)</span>}
                  </p>
                  {!u.role && <p className="mt-0.5 text-xs text-coral">No role assigned</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    options={ROLE_OPTIONS}
                    value={u.role ?? "operations"}
                    onChange={(role) => handleRoleChange(u, role)}
                  />
                  <IconButton
                    variant="danger"
                    disabled={isSelf || busy}
                    onClick={() => handleDelete(u)}
                    aria-label="Remove user"
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add user">
        <UserForm onSubmit={handleCreate} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
