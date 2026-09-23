"use client";

import { useState } from "react";
import { Button } from "@/components/admin/ui/button";
import { Input, Label } from "@/components/admin/ui/input";
import { SegmentedControl } from "@/components/admin/ui/segmented-control";
import { ROLE_OPTIONS, Role } from "@/lib/accessly/api";

export type UserFormValue = {
  email: string;
  role: Role;
};

export function UserForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (value: UserFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("operations");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ email, role });
    } catch {
      setError("Failed to add user. They may already exist.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="user-email">Email</Label>
        <Input
          id="user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          required
        />
      </div>
      <div>
        <Label htmlFor="user-role">Role</Label>
        <div id="user-role">
          <SegmentedControl options={ROLE_OPTIONS} value={role} onChange={setRole} />
        </div>
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          Add user
        </Button>
      </div>
    </form>
  );
}
