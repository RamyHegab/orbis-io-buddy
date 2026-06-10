import { createFileRoute } from "@tanstack/react-router";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/forms")({
  head: () => ({ meta: [{ title: "Forms — Orbis CRM" }] }),
  component: FormsPage,
});

function FormsPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Forms"
        description="Recruitment forms and QR codes for capturing student leads during trips."
      />
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Build reusable form templates, generate per-activity QR codes, and review
          submissions here. Form templates can already be authored under{" "}
          <span className="font-medium text-foreground">Form Templates</span>.
        </CardContent>
      </Card>
    </PageContainer>
  );
}
