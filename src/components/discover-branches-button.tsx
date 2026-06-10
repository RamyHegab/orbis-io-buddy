import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { discoverBranchesForAgent } from "@/lib/branch-discovery.functions";
import { useIsAdmin } from "@/hooks/use-auth";

export function DiscoverBranchesButton({ agentId }: { agentId: string }) {
  const isAdmin = useIsAdmin();
  const fn = useServerFn(discoverBranchesForAgent);
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  if (!isAdmin) return null;

  const run = async () => {
    setLoading(true);
    toast.info("Searching the web for branches…");
    try {
      const res = (await fn({ data: { agentId } })) as { found: number };
      if (res.found > 0) {
        toast.success(`Found ${res.found} candidate branch${res.found === 1 ? "" : "es"} — review in Inbox.`);
        qc.invalidateQueries({ queryKey: ["pending_submissions"] });
      } else {
        toast.message("No branches found on the web for this agent.");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Discovery failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={run} disabled={loading}>
      {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
      Discover from web
    </Button>
  );
}
