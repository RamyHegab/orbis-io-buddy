import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  DialogDescription,
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  listUsers,
  inviteUser,
  updateUser,
  resendInvite,
  listAssignableManagers,
  getRoleDefaults,
  freezeUser,
  unfreezeUser,
  deleteUser,
} from "@/lib/users.functions";
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
import { AlertTriangle, ChevronLeft, ChevronRight, Snowflake, Trash2 } from "lucide-react";

type Role = "admin" | "user";

type UserRow = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_role: string | null;
  line_manager_id: string | null;
  frozen_at: string | null;
  email: string | null;
  status: string;
  role: Role;
  last_sign_in_at: string | null;
  email_local_part: string | null;
  assigned_agent_ids: string[];
} & CapabilityMap;

type AgentLite = {
  id: string;
  trading_name: string;
  hq_country: string | null;
  countries_of_operation: string[] | null;
};

type ManagerLite = {
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  job_role: string | null;
};

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

const EMPTY_CAPS: CapabilityMap = {
  can_manage_agents: false,
  can_manage_schools: false,
  can_view_all_trips: false,
  can_manage_templates: false,
  can_manage_users: false,
};

function displayName(u: { full_name: string | null; first_name: string | null; last_name: string | null; email: string | null }) {
  return (
    u.full_name?.trim() ||
    [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
    u.email ||
    "—"
  );
}

function UsersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const inviteFn = useServerFn(inviteUser);
  const updateFn = useServerFn(updateUser);
  const resendFn = useServerFn(resendInvite);
  const managersFn = useServerFn(listAssignableManagers);
  const roleDefaultsFn = useServerFn(getRoleDefaults);
  const freezeFn = useServerFn(freezeUser);
  const unfreezeFn = useServerFn(unfreezeUser);
  const deleteFn = useServerFn(deleteUser);
  const { caps: inviterCaps } = useCapabilities();

  const { data: users = [], isLoading } = useQuery<UserRow[]>({
    queryKey: ["users"],
    queryFn: () => listFn({}) as Promise<UserRow[]>,
  });

  const { data: managers = [] } = useQuery<ManagerLite[]>({
    queryKey: ["users", "assignable-managers"],
    queryFn: () => managersFn({}) as Promise<ManagerLite[]>,
  });

  const { data: agents = [] } = useQuery<AgentLite[]>({
    queryKey: ["agents", "lite"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agents")
        .select("id, trading_name, hq_country, countries_of_operation")
        .order("trading_name");
      return (data ?? []) as AgentLite[];
    },
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

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["users"] });
  };

  const invite = useMutation({
    mutationFn: (input: Parameters<typeof inviteFn>[0]["data"]) => inviteFn({ data: input }),
    onSuccess: () => {
      toast.success("Invite sent");
      setInviteOpen(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (input: Parameters<typeof updateFn>[0]["data"]) => updateFn({ data: input }),
    onSuccess: () => {
      toast.success("User updated");
      setEditing(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resend = useMutation({
    mutationFn: (email: string) => resendFn({ data: { email } }),
    onSuccess: () => toast.success("Invite re-sent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const freeze = useMutation({
    mutationFn: (userId: string) => freezeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account frozen");
      setEditing(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unfreeze = useMutation({
    mutationFn: (userId: string) => unfreezeFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Account reactivated");
      setEditing(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (input: { userId: string; confirmation: string }) => deleteFn({ data: input }),
    onSuccess: () => {
      toast.success("User deleted");
      setEditing(null);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Invite users, assign line managers and agents, and set permissions. New users only receive permissions you already hold. Trip approvals go to admins."
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
                  <TableHead>Job role</TableHead>
                  <TableHead>Line manager</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const mgr = users.find((x) => x.id === u.line_manager_id);
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{displayName(u)}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{u.job_role || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {mgr ? displayName(mgr) : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === "admin" ? "default" : "secondary"}>
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {u.assigned_agent_ids.length || <span className="text-muted-foreground">0</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.status === "active"
                              ? "outline"
                              : u.status === "disabled"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {u.status === "disabled" ? "frozen" : u.status}
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <InviteWizard
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        inviterCaps={inviterCaps}
        senderSubdomain={senderSubdomain ?? null}
        managers={managers}
        agents={agents}
        loadRoleDefaults={(jobRole) =>
          roleDefaultsFn({ data: { jobRole } }) as Promise<Partial<CapabilityMap> | null>
        }
        onSubmit={(v) => invite.mutate(v)}
        submitting={invite.isPending}
      />

      <EditDialog
        user={editing}
        onClose={() => setEditing(null)}
        inviterCaps={inviterCaps}
        senderSubdomain={senderSubdomain ?? null}
        managers={managers}
        agents={agents}
        onSubmit={(v) => update.mutate(v)}
        submitting={update.isPending}
        onFreeze={(id) => freeze.mutate(id)}
        onUnfreeze={(id) => unfreeze.mutate(id)}
        onDelete={(id, confirmation) => remove.mutate({ userId: id, confirmation })}
        freezing={freeze.isPending || unfreeze.isPending}
        deleting={remove.isPending}
      />
    </PageContainer>
  );
}

/* ------------------------------ Shared UI ------------------------------ */

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
              onCheckedChange={(checked) => onChange({ ...value, [c]: checked === true })}
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

function AgentAssignment({
  value,
  onChange,
  agents,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  agents: AgentLite[];
}) {
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string>("__all");
  const [scope, setScope] = useState<"hq" | "ops" | "either">("either");

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const a of agents) {
      if (a.hq_country) set.add(a.hq_country);
      for (const c of a.countries_of_operation ?? []) set.add(c);
    }
    return Array.from(set).sort();
  }, [agents]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return agents.filter((a) => {
      if (needle && !a.trading_name.toLowerCase().includes(needle)) return false;
      if (country !== "__all") {
        const inHq = a.hq_country === country;
        const inOps = (a.countries_of_operation ?? []).includes(country);
        if (scope === "hq" && !inHq) return false;
        if (scope === "ops" && !inOps) return false;
        if (scope === "either" && !inHq && !inOps) return false;
      }
      return true;
    });
  }, [agents, q, country, scope]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <Input placeholder="Search agents…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger>
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">All countries</SelectItem>
            {countryOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={scope} onValueChange={(v) => setScope(v as "hq" | "ops" | "either")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="either">HQ or operations</SelectItem>
            <SelectItem value="hq">HQ country only</SelectItem>
            <SelectItem value="ops">Operates in country</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filtered.length} agents · {value.length} selected</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(Array.from(new Set([...value, ...filtered.map((a) => a.id)])))}
          >
            Select all filtered
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Clear
          </Button>
        </div>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-md border">
        {filtered.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">No agents match.</div>
        ) : (
          <ul className="divide-y">
            {filtered.map((a) => (
              <li key={a.id}>
                <label className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={value.includes(a.id)}
                    onCheckedChange={() => toggle(a.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.trading_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {a.hq_country ? `HQ: ${a.hq_country}` : "HQ: —"}
                      {a.countries_of_operation?.length
                        ? ` · Ops: ${a.countries_of_operation.join(", ")}`
                        : ""}
                    </div>
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Invite Wizard ------------------------------ */

type InvitePayload = {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  jobRole?: string;
  role: Role;
  capabilities?: Partial<CapabilityMap>;
  emailLocalPart?: string | null;
  lineManagerId?: string | null;
  assignedAgentIds?: string[];
};

function InviteWizard({
  open,
  onClose,
  inviterCaps,
  senderSubdomain,
  managers,
  agents,
  loadRoleDefaults,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  inviterCaps: CapabilityMap;
  senderSubdomain: string | null;
  managers: ManagerLite[];
  agents: AgentLite[];
  loadRoleDefaults: (jobRole: string) => Promise<Partial<CapabilityMap> | null>;
  onSubmit: (v: InvitePayload) => void;
  submitting: boolean;
}) {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [email, setEmail] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [localPartTouched, setLocalPartTouched] = useState(false);
  const [role, setRole] = useState<Role>("user");
  const [lineManagerId, setLineManagerId] = useState<string | "__self">("__self");
  const [assignedAgentIds, setAssignedAgentIds] = useState<string[]>([]);
  const [caps, setCaps] = useState<CapabilityMap>(EMPTY_CAPS);
  const lastLoadedRole = useRef<string>("");

  const inviterIsAdmin = ALL_CAPABILITIES.every((c) => inviterCaps[c]);
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const autoLocal = deriveLocalPartFromName(fullName, email);
  const effectiveLocal = localPartTouched ? localPart : autoLocal;
  const localInvalid = !!effectiveLocal && !isValidLocalPart(effectiveLocal);

  // When jobRole changes, prefill caps from role defaults (only if user hasn't touched them yet).
  useEffect(() => {
    const jr = jobRole.trim().toLowerCase();
    if (!jr || jr === lastLoadedRole.current) return;
    lastLoadedRole.current = jr;
    loadRoleDefaults(jr).then((defaults) => {
      if (!defaults) return;
      setCaps((prev) => {
        // only apply if caps still look empty
        const allEmpty = ALL_CAPABILITIES.every((c) => !prev[c]);
        if (!allEmpty) return prev;
        const next = { ...EMPTY_CAPS };
        for (const c of ALL_CAPABILITIES) if (defaults[c] && inviterCaps[c]) next[c] = true;
        return next;
      });
    });
  }, [jobRole, loadRoleDefaults, inviterCaps]);

  const reset = () => {
    setStep(1);
    setFirstName("");
    setLastName("");
    setJobRole("");
    setEmail("");
    setLocalPart("");
    setLocalPartTouched(false);
    setRole("user");
    setLineManagerId("__self");
    setAssignedAgentIds([]);
    setCaps(EMPTY_CAPS);
    lastLoadedRole.current = "";
  };

  const canNextFromStep1 = !!email && !!firstName && !localInvalid;

  const submit = () => {
    onSubmit({
      email,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      fullName: fullName || undefined,
      jobRole: jobRole || undefined,
      role,
      capabilities: role === "user" ? caps : undefined,
      emailLocalPart: effectiveLocal || null,
      lineManagerId: lineManagerId === "__self" ? null : lineManagerId,
      assignedAgentIds,
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          reset();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invite user · Step {step} of 4</DialogTitle>
          <DialogDescription>
            {step === 1 && "Basics — name, job role and login email."}
            {step === 2 && "Line manager — who this person reports to."}
            {step === 3 && "Assign agents — the agents this user will look after."}
            {step === 4 && "Permissions — what this user can do in Orbis."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Job role</Label>
              <Input
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                placeholder="e.g. Regional Recruitment Officer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                We'll remember default permissions per job role and pre-fill them for the next user with the same role.
              </p>
            </div>
            <div>
              <Label>Login email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
              />
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
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Alert>
              <AlertTitle>What a line manager does</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <div>· Approves this user's trip itineraries.</div>
                <div>· Receives reminders when this user's actions are overdue.</div>
                <div>· Can invite and edit users under their own tree.</div>
                <div>Default is you. You can pick anyone who reports to you (or, if you're an admin, anyone).</div>
              </AlertDescription>
            </Alert>
            <div>
              <Label>Line manager</Label>
              <Select value={lineManagerId} onValueChange={(v) => setLineManagerId(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__self">You (default)</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {displayName(m)}
                      {m.job_role ? ` · ${m.job_role}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 3 && (
          <AgentAssignment
            value={assignedAgentIds}
            onChange={setAssignedAgentIds}
            agents={agents}
          />
        )}

        {step === 4 && (
          <div className="space-y-3">
            {role === "admin" ? (
              <Alert>
                <AlertTitle>Admin</AlertTitle>
                <AlertDescription className="text-xs">
                  Admins receive every permission. You can adjust these later by changing their role to User.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Defaults are pre-filled from previous users with the job role
                  {jobRole ? ` "${jobRole}"` : ""}. Adjust as needed — this selection becomes the new default for this job role.
                </p>
                <CapabilityChecklist value={caps} onChange={setCaps} inviterCaps={inviterCaps} />
              </>
            )}
          </div>
        )}

        <DialogFooter className="flex sm:justify-between gap-2">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !canNextFromStep1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={submit} disabled={submitting || !canNextFromStep1}>
                {submitting ? "Sending…" : "Send invite"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------ Edit dialog ------------------------------ */

function EditDialog({
  user,
  onClose,
  inviterCaps,
  senderSubdomain,
  managers,
  agents,
  onSubmit,
  submitting,
  onFreeze,
  onUnfreeze,
  onDelete,
  freezing,
  deleting,
}: {
  user: UserRow | null;
  onClose: () => void;
  inviterCaps: CapabilityMap;
  senderSubdomain: string | null;
  managers: ManagerLite[];
  agents: AgentLite[];
  onSubmit: (v: {
    userId: string;
    role?: Role;
    status?: "active" | "disabled";
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string;
    jobRole?: string | null;
    lineManagerId?: string | null;
    assignedAgentIds?: string[];
    capabilities?: Partial<CapabilityMap>;
    emailLocalPart?: string | null;
  }) => void;
  submitting: boolean;
  onFreeze: (id: string) => void;
  onUnfreeze: (id: string) => void;
  onDelete: (id: string, confirmation: string) => void;
  freezing: boolean;
  deleting: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobRole, setJobRole] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [caps, setCaps] = useState<CapabilityMap>(EMPTY_CAPS);
  const [localPart, setLocalPart] = useState("");
  const [lineManagerId, setLineManagerId] = useState<string | "__none">("__none");
  const [assignedAgentIds, setAssignedAgentIds] = useState<string[]>([]);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const inviterIsAdmin = ALL_CAPABILITIES.every((c) => inviterCaps[c]);

  useStateSync(user, (u) => {
    setFirstName(u.first_name ?? "");
    setLastName(u.last_name ?? "");
    setJobRole(u.job_role ?? "");
    setRole(u.role);
    setLocalPart(u.email_local_part ?? "");
    setLineManagerId(u.line_manager_id ?? "__none");
    setAssignedAgentIds(u.assigned_agent_ids ?? []);
    setCaps({
      can_manage_agents: u.can_manage_agents,
      can_manage_schools: u.can_manage_schools,
      can_view_all_trips: u.can_view_all_trips,
      can_manage_templates: u.can_manage_templates,
      can_manage_users: u.can_manage_users,
    });
    setShowDelete(false);
    setDeleteConfirm("");
  });

  if (!user) return null;

  const localInvalid = !!localPart && !isValidLocalPart(localPart);
  const isFrozen = user.status === "disabled";

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {displayName(user)}</DialogTitle>
          <DialogDescription>{user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Job role</Label>
            <Input value={jobRole} onChange={(e) => setJobRole(e.target.value)} />
          </div>

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
            {localInvalid && (
              <p className="text-xs text-destructive mt-1">
                Only letters, numbers, . _ - are allowed.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
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
            <div>
              <Label>Line manager</Label>
              <Select value={lineManagerId} onValueChange={(v) => setLineManagerId(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— None —</SelectItem>
                  {managers
                    .filter((m) => m.id !== user.id)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {displayName(m)}
                        {m.job_role ? ` · ${m.job_role}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {role === "user" && (
            <div>
              <Label>Permissions</Label>
              <CapabilityChecklist value={caps} onChange={setCaps} inviterCaps={inviterCaps} />
            </div>
          )}

          <div>
            <Label>Assigned agents ({assignedAgentIds.length})</Label>
            <div className="mt-2">
              <AgentAssignment
                value={assignedAgentIds}
                onChange={setAssignedAgentIds}
                agents={agents}
              />
            </div>
          </div>

          <Separator />

          {/* Danger zone */}
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium text-sm">Danger zone</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Freezing an account is the safe default — the user can no longer sign in, but their data, trips and history stay intact. Deleting is permanent.
            </p>
            <div className="flex flex-wrap gap-2">
              {isFrozen ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onUnfreeze(user.id)}
                  disabled={freezing}
                >
                  <Snowflake className="h-4 w-4 mr-1" />
                  Unfreeze account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFreeze(user.id)}
                  disabled={freezing}
                >
                  <Snowflake className="h-4 w-4 mr-1" />
                  Freeze account
                </Button>
              )}
              {inviterIsAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setShowDelete((v) => !v)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {showDelete ? "Cancel delete" : "Delete permanently"}
                </Button>
              )}
            </div>
            {showDelete && inviterIsAdmin && (
              <div className="space-y-2 rounded-md border border-destructive/40 bg-background p-3">
                <p className="text-xs">
                  This cannot be undone. Type the user's email{" "}
                  <span className="font-mono">{user.email}</span> to confirm.
                </p>
                <Input
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={user.email ?? ""}
                />
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    deleting ||
                    deleteConfirm.trim().toLowerCase() !==
                      (user.email ?? "").trim().toLowerCase()
                  }
                  onClick={() => onDelete(user.id, deleteConfirm)}
                >
                  {deleting ? "Deleting…" : "Delete user permanently"}
                </Button>
              </div>
            )}
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
                firstName: firstName || null,
                lastName: lastName || null,
                fullName: [firstName, lastName].filter(Boolean).join(" ").trim() || undefined,
                jobRole: jobRole ? jobRole : null,
                lineManagerId: lineManagerId === "__none" ? null : lineManagerId,
                assignedAgentIds,
                capabilities: role === "user" ? caps : undefined,
                emailLocalPart: localPart || null,
              })
            }
          >
            {submitting ? "Saving…" : "Save changes"}
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
