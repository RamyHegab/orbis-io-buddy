import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, useRole, useCapabilities } from "@/hooks/use-auth";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Bell, Settings as SettingsIcon, UserCog, LogOut, User } from "lucide-react";
import { ProfileDialog } from "@/components/profile-dialog";

export function HeaderMenu() {
  const { user } = useAuth();
  const { role } = useRole();
  const { caps } = useCapabilities();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: profile } = useQuery({
    enabled: !!user,
    queryKey: ["profile-header", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const [signedAvatar, setSignedAvatar] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const path = profile?.avatar_url;
      if (!path) { setSignedAvatar(null); return; }
      if (path.startsWith("http")) { setSignedAvatar(path); return; }
      const { data } = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
      if (alive) setSignedAvatar(data?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [profile?.avatar_url]);

  const { data: pendingCount = 0 } = useQuery({
    enabled: !!user,
    queryKey: ["pending_submissions_count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("pending_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      return count ?? 0;
    },
    refetchInterval: 30000,
  });

  const displayName = profile?.full_name || user?.email || "";
  const initials = displayName.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase() || "?";

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Link to="/inbox">
            <Bell className="h-5 w-5" />
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex min-w-[1.1rem] h-[1.1rem] items-center justify-center rounded-full bg-gold px-1 text-[10px] font-semibold text-gold-foreground">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent transition-colors" aria-label="Account menu">
              <Avatar className="h-8 w-8">
                {signedAvatar ? <AvatarImage src={signedAvatar} alt={displayName} /> : null}
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="text-sm font-medium truncate">{displayName}</div>
              <div className="text-xs text-muted-foreground capitalize">{role ?? "member"}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
              <User className="h-4 w-4 mr-2" /> My profile
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/inbox"><Bell className="h-4 w-4 mr-2" /> Notifications</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/settings"><SettingsIcon className="h-4 w-4 mr-2" /> Settings</Link>
            </DropdownMenuItem>
            {caps.can_manage_users && (
              <DropdownMenuItem asChild>
                <Link to="/users"><UserCog className="h-4 w-4 mr-2" /> Users</Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
