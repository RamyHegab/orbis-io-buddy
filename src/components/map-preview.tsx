import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/google-maps";

type Props = {
  lat: number | null | undefined;
  lng: number | null | undefined;
  query?: string | null;
  height?: number;
  className?: string;
};

// Compact, read-only Google map preview. Uses google.maps.Marker (not
// AdvancedMarkerElement) and no mapId, per project rules.
export function MapPreview({ lat, lng, query, height = 160, className }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    const hasCoords = typeof lat === "number" && typeof lng === "number";
    if (!hasCoords && !query) return;

    loadGoogleMaps().then(async (google) => {
      if (cancelled || !ref.current) return;
      let center = hasCoords ? { lat: lat as number, lng: lng as number } : null;

      if (!center && query) {
        // Use Places Text Search to find a centre when only a free-form query exists.
        try {
          const { Place } = await google.maps.importLibrary("places");
          const { places } = await Place.searchByText({
            textQuery: query,
            fields: ["location"],
            maxResultCount: 1,
          });
          if (places?.[0]?.location) {
            center = { lat: places[0].location.lat(), lng: places[0].location.lng() };
          }
        } catch {
          /* swallow — preview just won't render */
        }
      }
      if (!center) return;

      if (!mapRef.current) {
        mapRef.current = new google.maps.Map(ref.current, {
          center,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
        });
      } else {
        mapRef.current.setCenter(center);
      }
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = new google.maps.Marker({ position: center, map: mapRef.current });
    }).catch(() => { /* preview hidden */ });

    return () => { cancelled = true; };
  }, [lat, lng, query]);

  if (lat == null && lng == null && !query) return null;
  return <div ref={ref} className={className} style={{ width: "100%", height, borderRadius: 8, overflow: "hidden" }} />;
}
