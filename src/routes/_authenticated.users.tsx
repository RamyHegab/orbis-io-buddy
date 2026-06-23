import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers, inviteUser, updateUser, resendInvite } from "@/lib/users.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Role = "admin" | "manager" | "member";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Orbis CRM" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const inviteFn = useServerFn(inviteUser);
  const updateFn = useServerFn(updateUser);
  const resendFn = useServerFn(resendInvite);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listFn({}),
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<null | (typeof users)[number]>(null);

  const invite = useMutation({
    mutationFn: (input: {
      email: string;
      fullName?: string;
      role: Role;
      lineManagerId?: string | null;
    }) => inviteFn({ data: input }),
    onSuccess: () => {
      toast.success("Invite sent");
      setInviteOpen(false);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: {
      userId: string;
      role?: Role;
      lineManagerId?: string | null;
      status?: "active" | "disabled";
      fullName?: string;
    }) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("User updated");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: (email: string) => resendFn({ data: { email } }),
    onSuccess: () => toast.success("Invite re-sent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const nameOf = (id: string | null) =>
    id ? users.find((u) => u.id === id)?.full_name || users.find((u) => u.id === id)?.email || "—" : "—";

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Invite team members, assign roles, and set line managers for approvals."
        actions={<Button onClick={() => setInviteOpen(true)}>Invite user</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Team ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Line manager</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last sign-in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell>{nameOf(u.line_manager_id)}</TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "outline" : "destructive"}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_sign_in_at
                        ? new Date(u.last_sign_in_at).toLocaleDateString()
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      {u.status === "invited" && u.email && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resend.mutate(u.email!)}
                          disabled={resend.isPending}
                        >
                          Resend
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        users={users}
        onSubmit={(v) => invite.mutate(v)}
        submitting={invite.isPending}
      />

      <EditDialog
        user={editing}
        onClose={() => setEditing(null)}
        users={users}
        onSubmit={(v) => update.mutate(v)}
        submitting={update.isPending}
      />
    </PageContainer>
  );
}

function InviteDialog({
  open,
  onClose,
  users,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  users: Array<{ id: string; full_name: string | null; email: string | null }>;
  onSubmit: (v: {
    email: string;
    fullName?: string;
    role: Role;
    lineManagerId?: string | null;
  }) => void;
  submitting: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [lineManagerId, setLineManagerId] = useState<string>("none");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setEmail("");
          setFullName("");
          setRole("member");
          setLineManagerId("none");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <Label>Full name (optional)</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Line manager</Label>
            <Select value={lineManagerId} onValueChange={setLineManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!email || submitting}
            onClick={() =>
              onSubmit({
                email,
                fullName: fullName || undefined,
                role,
                lineManagerId: lineManagerId === "none" ? null : lineManagerId,
              })
            }
          >
            {submitting ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  user,
  onClose,
  users,
  onSubmit,
  submitting,
}: {
  user: null | {
    id: string;
    full_name: string | null;
    email: string | null;
    role: Role;
    line_manager_id: string | null;
    status: string;
  };
  onClose: () => void;
  users: Array<{ id: string; full_name: string | null; email: string | null }>;
  onSubmit: (v: {
    userId: string;
    role?: Role;
    lineManagerId?: string | null;
    status?: "active" | "disabled";
  }) => void;
  submitting: boolean;
}) {
  const [role, setRole] = useState<Role>(user?.role ?? "member");
  const [lineManagerId, setLineManagerId] = useState<string>(user?.line_manager_id ?? "none");
  const [status, setStatus] = useState<string>(user?.status ?? "active");

  // Re-init when opening
  useStateSync(user, (u) => {
    setRole(u.role);
    setLineManagerId(u.line_manager_id ?? "none");
    setStatus(u.status);
  });

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.full_name || user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Line manager</Label>
            <Select value={lineManagerId} onValueChange={setLineManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {users
                  .filter((u) => u.id !== user.id)
                  .map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.email}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled (block sign-in)</SelectItem>
                {user.status === "invited" && <SelectItem value="invited">Invited</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={submitting}
            onClick={() =>
              onSubmit({
                userId: user.id,
                role,
                lineManagerId: lineManagerId === "none" ? null : lineManagerId,
                status: status === "disabled" ? "disabled" : status === "active" ? "active" : undefined,
              })
            }
          >
            {submitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useRef } from "react";
function useStateSync<T>(value: T, apply: (v: NonNullable<T>) => void) {
  const lastId = useRef<unknown>(null);
  useEffect(() => {
    if (!value) return;
    const id = (value as { id?: unknown })?.id;
    if (id !== lastId.current) {
      lastId.current = id;
      apply(value as NonNullable<T>);
    }
  }, [value, apply]);
}
