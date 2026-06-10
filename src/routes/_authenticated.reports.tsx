import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — Orbis CRM" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Reports"
        description="Post-trip summaries, lead funnels, and recruitment analytics."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Aggregate trip reports, agent performance, and school engagement will live
          here. Individual trip reports are available from each trip page.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
