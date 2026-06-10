import { Button } from "@/components/ui/button";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import type { ImportType } from "@/lib/import-mapping";

export function ShareIntakeLink({ type, agentId, label = "Share intake form" }: { type: ImportType; agentId?: string; label?: string }) {
  const onClick = () => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${base}/public/intake/${type}${agentId ? `?agent=${agentId}` : ""}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success("Intake form link copied"),
      () => toast.error("Could not copy"),
    );
  };
  return (
    <Button variant="outline" onClick={onClick}>
      <Link2 className="h-4 w-4 mr-1" /> {label}
    </Button>
  );
}
