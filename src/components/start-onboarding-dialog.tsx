import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { startOnboarding } from "@/lib/onboarding.functions";

export function StartOnboardingDialog({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted?: (res: { agentId: string; onboardingId: string; shareToken: string | null }) => void;
}) {
  const qc = useQueryClient();
  const startFn = useServerFn(startOnboarding);
  const [tradingName, setTradingName] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const mutation = useMutation({
    mutationFn: () => startFn({ data: { tradingName, contactEmail } }),
    onSuccess: (res) => {
      toast.success("Agent added to onboarding");
      qc.invalidateQueries({ queryKey: ["onboarding-list"] });
      setTradingName("");
      setContactEmail("");
      onClose();
      if (!res.shareToken) {
        toast.warning(
          "Agent Signup form is inactive. Ask an admin to configure it in Forms so a share link can be generated.",
        );
      }
      onStarted?.(res);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start onboarding</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Agent / company name</Label>
            <Input value={tradingName} onChange={(e) => setTradingName(e.target.value)} />
          </div>
          <div>
            <Label>Primary contact email</Label>
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="contact@agent.com"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            We'll create a draft record and generate a share link for the Agent Signup form.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!tradingName || !contactEmail || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Starting…" : "Start"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
