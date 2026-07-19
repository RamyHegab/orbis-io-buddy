import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ALL_CAPABILITIES,
  CAPABILITY_LABELS,
  useCapabilities,
  type Capability,
  type CapabilityMap,
} from "@/hooks/use-auth";
import {
  ROOT_DOMAIN,
  deriveLocalPartFromName,
  isValidLocalPart,
  sanitizeLocalPart,
} from "@/lib/system-email";

type Role = "admin" | "user";

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  role: Role;
  last_sign_in_at: string | null;
  email_local_part: string | null;
} & CapabilityMap;

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users — Orbis CRM" }] }),
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: u.user.id,
      _role: "admin",
    });
    if (isAdmin) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("can_manage_users")
      .eq("id", u.user.id)
      .maybeSingle();
    if (!profile?.can_manage_users) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const inviteFn = useServerFn(inviteUser);
  const updateFn = useServerFn(updateUser);
  const resendFn = useServerFn(resendInvite);
  const { caps: inviterCaps } = useCapabilities();

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => listFn({}) as Promise<UserRow[]>,
  });

  const { data: senderSubdomain } = useQuery({
    queryKey: ["app_settings", "sender_subdomain"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("sender_subdomain")
        .eq("id", 1)
        .maybeSingle();
      return (data as any)?.sender_subdomain as string | null;
    },
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);

  const invite = useMutation({
    mutationFn: (input: {
      email: string;
      fullName?: string;
      role: Role;
      capabilities?: Partial<CapabilityMap>;
      emailLocalPart?: string | null;
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
      status?: "active" | "disabled";
      fullName?: string;
      capabilities?: Partial<CapabilityMap>;
      emailLocalPart?: string | null;
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

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Invite users and set permissions. New users can only receive permissions you already have. Trip approvals go to admins."
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
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
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
                    <TableCell className="text-xs">
                      {u.role === "admin" ? (
                        <span className="text-muted-foreground">All</span>
                      ) : (
                        <PermissionSummary user={u} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "outline" : "destructive"}>
                        {u.status}
                      </Badge>
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
        inviterCaps={inviterCaps}
        senderSubdomain={senderSubdomain ?? null}
        onSubmit={(v) => invite.mutate(v)}
        submitting={invite.isPending}
      />

      <EditDialog
        user={editing}
        onClose={() => setEditing(null)}
        inviterCaps={inviterCaps}
        senderSubdomain={senderSubdomain ?? null}
        onSubmit={(v) => update.mutate(v)}
        submitting={update.isPending}
      />
    </PageContainer>
  );
}

function PermissionSummary({ user }: { user: UserRow }) {
  const active = ALL_CAPABILITIES.filter((c) => user[c]);
  if (active.length === 0) return <span className="text-muted-foreground">None</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {active.map((c) => (
        <Badge key={c} variant="outline" className="text-[10px]">
          {shortLabel(c)}
        </Badge>
      ))}
    </div>
  );
}

function shortLabel(c: Capability) {
  return {
    can_manage_agents: "Agents",
    can_manage_schools: "Schools",
    can_view_all_trips: "All trips",
    can_manage_templates: "Templates",
    can_manage_users: "Users",
  }[c];
}

function CapabilityChecklist({
  value,
  onChange,
  inviterCaps,
  disabled,
}: {
  value: CapabilityMap;
  onChange: (v: CapabilityMap) => void;
  inviterCaps: CapabilityMap;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      {ALL_CAPABILITIES.map((c) => {
        const allowed = inviterCaps[c];
        return (
          <label
            key={c}
            className={`flex items-start gap-2 text-sm ${!allowed ? "opacity-50" : ""}`}
          >
            <Checkbox
              checked={!!value[c]}
              disabled={disabled || !allowed}
              onCheckedChange={(checked) =>
                onChange({ ...value, [c]: checked === true })
              }
            />
            <span>
              {CAPABILITY_LABELS[c]}
              {!allowed && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (you don't have this permission)
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const EMPTY_CAPS: CapabilityMap = {
  can_manage_agents: false,
  can_manage_schools: false,
  can_view_all_trips: false,
  can_manage_templates: false,
  can_manage_users: false,
};

function InviteDialog({
  open,
  onClose,
  inviterCaps,
  senderSubdomain,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  inviterCaps: CapabilityMap;
  senderSubdomain: string | null;
  onSubmit: (v: {
    email: string;
    fullName?: string;
    role: Role;
    capabilities?: Partial<CapabilityMap>;
    emailLocalPart?: string | null;
  }) => void;
  submitting: boolean;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [caps, setCaps] = useState<CapabilityMap>(EMPTY_CAPS);
  const [localPart, setLocalPart] = useState("");
  const [localPartTouched, setLocalPartTouched] = useState(false);

  const inviterIsAdmin = ALL_CAPABILITIES.every((c) => inviterCaps[c]);

  const autoLocal = deriveLocalPartFromName(fullName, email);
  const effectiveLocal = localPartTouched ? localPart : autoLocal;
  const previewAddress =
    effectiveLocal && senderSubdomain
      ? `${effectiveLocal}@${senderSubdomain}.${ROOT_DOMAIN}`
      : null;
  const localInvalid = !!effectiveLocal && !isValidLocalPart(effectiveLocal);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setEmail("");
          setFullName("");
          setRole("user");
          setCaps(EMPTY_CAPS);
          setLocalPart("");
          setLocalPartTouched(false);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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
            <Label>System email (sender identity)</Label>
            <div className="flex items-center gap-1">
              <Input
                value={effectiveLocal}
                onChange={(e) => {
                  setLocalPartTouched(true);
                  setLocalPart(sanitizeLocalPart(e.target.value));
                }}
                placeholder="firstname"
                className="max-w-[220px]"
              />
              <span className="text-sm text-muted-foreground">
                @{senderSubdomain || "<subdomain>"}.{ROOT_DOMAIN}
              </span>
            </div>
            {!senderSubdomain && (
              <p className="text-xs text-amber-600 mt-1">
                Set the account sender subdomain in Settings first.
              </p>
            )}
            {localInvalid && (
              <p className="text-xs text-destructive mt-1">
                Only letters, numbers, . _ - are allowed.
              </p>
            )}
            {previewAddress && !localInvalid && (
              <p className="text-xs text-muted-foreground mt-1">
                System emails will be sent from{" "}
                <span className="font-mono">{previewAddress}</span>
              </p>
            )}
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                {inviterIsAdmin && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {role === "user" && (
            <div>
              <Label>Permissions</Label>
              <CapabilityChecklist value={caps} onChange={setCaps} inviterCaps={inviterCaps} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!email || submitting || localInvalid}
            onClick={() =>
              onSubmit({
                email,
                fullName: fullName || undefined,
                role,
                capabilities: role === "user" ? caps : undefined,
                emailLocalPart: effectiveLocal || null,
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
  inviterCaps,
  senderSubdomain,
  onSubmit,
  submitting,
}: {
  user: UserRow | null;
  onClose: () => void;
  inviterCaps: CapabilityMap;
  senderSubdomain: string | null;
  onSubmit: (v: {
    userId: string;
    role?: Role;
    status?: "active" | "disabled";
    capabilities?: Partial<CapabilityMap>;
    emailLocalPart?: string | null;
  }) => void;
  submitting: boolean;
}) {
  const [role, setRole] = useState<Role>(user?.role ?? "user");
  const [status, setStatus] = useState<string>(user?.status ?? "active");
  const [caps, setCaps] = useState<CapabilityMap>(EMPTY_CAPS);
  const [localPart, setLocalPart] = useState(user?.email_local_part ?? "");

  const inviterIsAdmin = ALL_CAPABILITIES.every((c) => inviterCaps[c]);

  useStateSync(user, (u) => {
    setRole(u.role);
    setStatus(u.status);
    setLocalPart(u.email_local_part ?? "");
    setCaps({
      can_manage_agents: u.can_manage_agents,
      can_manage_schools: u.can_manage_schools,
      can_view_all_trips: u.can_view_all_trips,
      can_manage_templates: u.can_manage_templates,
      can_manage_users: u.can_manage_users,
    });
  });

  if (!user) return null;

  const previewAddress =
    localPart && senderSubdomain ? `${localPart}@${senderSubdomain}.${ROOT_DOMAIN}` : null;
  const localInvalid = !!localPart && !isValidLocalPart(localPart);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {user.full_name || user.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>System email (sender identity)</Label>
            <div className="flex items-center gap-1">
              <Input
                value={localPart}
                onChange={(e) => setLocalPart(sanitizeLocalPart(e.target.value))}
                placeholder="firstname"
                className="max-w-[220px]"
              />
              <span className="text-sm text-muted-foreground">
                @{senderSubdomain || "<subdomain>"}.{ROOT_DOMAIN}
              </span>
            </div>
            {!senderSubdomain && (
              <p className="text-xs text-amber-600 mt-1">
                Set the account sender subdomain in Settings first.
              </p>
            )}
            {localInvalid && (
              <p className="text-xs text-destructive mt-1">
                Only letters, numbers, . _ - are allowed.
              </p>
            )}
            {previewAddress && !localInvalid && (
              <p className="text-xs text-muted-foreground mt-1">
                System emails will be sent from{" "}
                <span className="font-mono">{previewAddress}</span>
              </p>
            )}
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                {inviterIsAdmin && <SelectItem value="admin">Admin</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {role === "user" && (
            <div>
              <Label>Permissions</Label>
              <CapabilityChecklist value={caps} onChange={setCaps} inviterCaps={inviterCaps} />
            </div>
          )}
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
            disabled={submitting || localInvalid}
            onClick={() =>
              onSubmit({
                userId: user.id,
                role,
                status:
                  status === "disabled" ? "disabled" : status === "active" ? "active" : undefined,
                capabilities: role === "user" ? caps : undefined,
                emailLocalPart: localPart || null,
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
