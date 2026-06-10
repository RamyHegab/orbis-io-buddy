import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Orbis CRM" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        description="Workspace, team, and integration preferences."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Manage team members, roles, Notion sync, and branding from this page.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
