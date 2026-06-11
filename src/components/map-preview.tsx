import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { loadGoogleMaps } from "@/lib/google-maps";

type Props = {
  lat: number | null | undefined;
  lng: number | null | undefined;
  query?: string | null;
  height?: number;
  className?: string;
  /** Optional external close handler. When provided, parent controls visibility. */
  onClose?: () => void;
  /** Show the close (X) button overlay. Defaults to true. */
  closable?: boolean;
};

// Compact, read-only Google map preview. Dismissible — once the lookup
// resolves and the map is shown, the user (or caller) can close it.
export function MapPreview({
  lat, lng, query, height = 160, className, onClose, closable = true,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [dismissed, setDismissed] = useState(false);

  // Re-open when the location target changes (new pick / new coords).
  useEffect(() => { setDismissed(false); }, [lat, lng, query]);

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    const hasCoords = typeof lat === "number" && typeof lng === "number";
    if (!hasCoords && !query) return;

    loadGoogleMaps().then(async (google) => {
      if (cancelled || !ref.current) return;
      let center = hasCoords ? { lat: lat as number, lng: lng as number } : null;

      if (!center && query) {
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
        } catch { /* swallow */ }
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
  }, [lat, lng, query, dismissed]);

  if (dismissed) return null;
  if (lat == null && lng == null && !query) return null;

  const handleClose = () => {
    if (onClose) onClose();
    else setDismissed(true);
  };

  return (
    <div className={className} style={{ position: "relative", width: "100%", height, borderRadius: 8, overflow: "hidden" }}>
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
      {closable && (
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close map"
          className="absolute top-1.5 right-1.5 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-background"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
