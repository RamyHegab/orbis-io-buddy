import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail, Phone, MapPin, GraduationCap } from "lucide-react";
import { AddToItineraryButton } from "@/components/add-to-itinerary-button";
import { mapsSearchUrl } from "@/lib/google-maps";

export const Route = createFileRoute("/_authenticated/schools/$schoolId")({
  component: SchoolDetail,
});

const LEVELS: Record<string, string> = {
  high_school: "High School",
  university: "University",
  language_school: "Language School",
  other: "Other",
};

function SchoolDetail() {
  const { schoolId } = Route.useParams();
  const navigate = useNavigate();

  const { data: school, isLoading } = useQuery({
    queryKey: ["school", schoolId],
    queryFn: async () => {
      const { data } = await supabase.from("schools").select("*").eq("id", schoolId).maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <PageContainer><div className="text-muted-foreground">Loading…</div></PageContainer>;
  }

  if (!school) {
    return (
      <PageContainer>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/schools" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Card className="p-10 text-center text-muted-foreground mt-4">School not found.</Card>
      </PageContainer>
    );
  }

  const mapUrl = mapsSearchUrl({
    query: school.formatted_address || school.address || `${school.name} ${school.city}`,
    placeId: school.place_id,
    lat: school.lat,
    lng: school.lng,
  });

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/schools" })} className="mb-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to schools
      </Button>
      <PageHeader
        title={school.name}
        description={`${school.city}${school.country ? `, ${school.country}` : ""} • ${LEVELS[school.level] ?? school.level}`}
        actions={
          <AddToItineraryButton
            source="school"
            id={school.id}
            name={school.name}
            address={school.address}
            formatted_address={school.formatted_address}
            place_id={school.place_id}
            lat={school.lat != null ? Number(school.lat) : null}
            lng={school.lng != null ? Number(school.lng) : null}
          />
        }
      />

      <div className="grid md:grid-cols-3 gap-4">
        <Card className="p-4 md:col-span-2 space-y-4">
          <div className="flex items-start gap-3">
            {school.campus_image_url ? (
              <img src={school.campus_image_url} alt={school.name} className="h-20 w-20 rounded-md object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-md bg-accent">
                <GraduationCap className="h-8 w-8" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {(school.formatted_address || school.address) && (
                <div className="text-sm flex items-start gap-1">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span>{school.formatted_address || school.address}</span>
                  {mapUrl && (
                    <a href={mapUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline ml-1 shrink-0">
                      Open in Maps
                    </a>
                  )}
                </div>
              )}
              {school.general_email && (
                <div className="text-sm flex items-center gap-1 mt-1">
                  <Mail className="h-4 w-4 text-muted-foreground" /> {school.general_email}
                </div>
              )}
              {school.general_phone && (
                <div className="text-sm flex items-center gap-1 mt-1">
                  <Phone className="h-4 w-4 text-muted-foreground" /> {school.general_phone}
                </div>
              )}
            </div>
          </div>

          {school.primary_contact_name && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Primary contact</h3>
              <div className="text-sm">
                <div className="font-medium">{school.primary_contact_name}{school.primary_contact_position ? ` · ${school.primary_contact_position}` : ""}</div>
                {school.primary_contact_email && <div className="text-muted-foreground">{school.primary_contact_email}</div>}
                {school.primary_contact_phone && <div className="text-muted-foreground">{school.primary_contact_phone}</div>}
              </div>
            </div>
          )}

          {school.secondary_contact_name && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Secondary contact</h3>
              <div className="text-sm">
                <div className="font-medium">{school.secondary_contact_name}</div>
                {school.secondary_contact_email && <div className="text-muted-foreground">{school.secondary_contact_email}</div>}
                {school.secondary_contact_phone && <div className="text-muted-foreground">{school.secondary_contact_phone}</div>}
              </div>
            </div>
          )}

          {school.notes && (
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Notes</h3>
              <p className="text-sm whitespace-pre-wrap">{school.notes}</p>
            </div>
          )}
        </Card>

        {(() => {
          const url = mapsSearchUrl({
            query: school.formatted_address || school.address,
            placeId: school.place_id,
            lat: school.lat,
            lng: school.lng,
          });
          return url ? (
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={url} target="_blank" rel="noreferrer">
                <MapPin className="h-4 w-4 mr-1" /> View on Google Maps
              </a>
            </Button>
          ) : null;
        })()}

      </div>
    </PageContainer>
  );
}
