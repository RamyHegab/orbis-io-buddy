import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { importNotionPlanning } from "@/lib/notion-planning.functions";
import { useQueryClient } from "@tanstack/react-query";

export function NotionImportDialog() {
  const qc = useQueryClient();
  const doImport = useServerFn(importNotionPlanning);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [tripsUrl, setTripsUrl] = useState("");
  const [eventsUrl, setEventsUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const extractDatabaseId = (url: string) => {
    // Handles both full Notion URLs and raw IDs
    if (!url) return "";
    // Try to grab UUID from URL like .../databases/{uuid} or .../{uuid}?v=...
    const match = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return match?.[1] ?? url.trim();
  };

  const run = async () => {
    const tripsDatabaseId = extractDatabaseId(tripsUrl);
    const eventsDatabaseId = extractDatabaseId(eventsUrl);
    if (!token.trim()) { toast.error("Paste your Notion integration token"); return; }
    if (!tripsDatabaseId && !eventsDatabaseId) { toast.error("Paste at least one Notion database link or ID"); return; }
    setBusy(true);
    try {
      const res = await doImport({ data: { notionToken: token, tripsDatabaseId, eventsDatabaseId } });
      toast.success(`Imported ${res.tripsImported} trips and ${res.eventsImported} events`);
      qc.invalidateQueries({ queryKey: ["planned_activities"] });
      qc.invalidateQueries({ queryKey: ["events_catalog"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message ?? "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-1" /> Import from Notion</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Import yearly planning from Notion</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground">
            <p>1. Create a Notion integration at <a href="https://www.notion.so/profile/integrations" target="_blank" rel="noreferrer" className="text-primary underline">notion.so/profile/integrations</a> and copy the token.</p>
            <p>2. Open each Notion database, click Share → Add connections, and pick your integration.</p>
            <p>3. Paste the database links (or IDs) below and click Import.</p>
          </div>
          <div>
            <Label>Notion integration token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="secret_..." type="password" />
          </div>
          <div>
            <Label>Trips / activities database link</Label>
            <Input value={tripsUrl} onChange={(e) => setTripsUrl(e.target.value)} placeholder="https://www.notion.so/..." />
          </div>
          <div>
            <Label>Events catalog database link</Label>
            <Input value={eventsUrl} onChange={(e) => setEventsUrl(e.target.value)} placeholder="https://www.notion.so/..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={run} disabled={busy}>{busy ? "Importing…" : "Import"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
