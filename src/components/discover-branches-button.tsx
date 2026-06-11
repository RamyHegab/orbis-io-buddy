import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Inbox } from "lucide-react";
import { discoverBranchesForAgent } from "@/lib/branch-discovery.functions";
import { useIsAdmin } from "@/hooks/use-auth";

type Phase = "idle" | "searching" | "done" | "empty" | "error";

export function DiscoverBranchesButton({ agentId }: { agentId: string }) {
  const isAdmin = useIsAdmin();
  const fn = useServerFn(discoverBranchesForAgent);
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [found, setFound] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  if (!isAdmin) return null;

  const open = phase !== "idle";
  const loading = phase === "searching";

  const run = async () => {
    setPhase("searching");
    setFound(0);
    setErrorMsg("");
    try {
      const res = (await fn({ data: { agentId } })) as { found: number };
      setFound(res.found);
      qc.invalidateQueries({ queryKey: ["pending_submissions"] });
      setPhase(res.found > 0 ? "done" : "empty");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Discovery failed");
      setPhase("error");
    }
  };

  const close = () => {
    if (loading) return;
    setPhase("idle");
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={run} disabled={loading}>
        <Sparkles className="h-4 w-4 mr-1" />
        Discover branches with AI
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
              {phase === "done" && <CheckCircle2 className="h-5 w-5 text-primary" />}
              {phase === "empty" && <Inbox className="h-5 w-5 text-muted-foreground" />}
              {phase === "error" && <AlertCircle className="h-5 w-5 text-destructive" />}
              {loading && "Searching the web…"}
              {phase === "done" && "Branches found"}
              {phase === "empty" && "No branches found"}
              {phase === "error" && "Discovery failed"}
            </DialogTitle>
            <DialogDescription>
              {loading &&
                "AI is scanning the agent's website and the wider web for branch offices. This usually takes 20–60 seconds."}
              {phase === "done" &&
                `Found ${found} candidate branch${found === 1 ? "" : "es"}. Review and approve them in your Inbox.`}
              {phase === "empty" &&
                "AI couldn't confidently identify any branch offices for this agent online."}
              {phase === "error" && errorMsg}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-2">
            {loading && (
              <Button variant="outline" disabled>
                Please wait…
              </Button>
            )}
            {phase === "done" && (
              <>
                <Button variant="outline" onClick={close}>Close</Button>
                <Button asChild onClick={close}>
                  <Link to="/inbox">
                    <Inbox className="h-4 w-4 mr-1" /> Go to Inbox
                  </Link>
                </Button>
              </>
            )}
            {(phase === "empty" || phase === "error") && (
              <Button onClick={close}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
