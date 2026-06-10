import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, ExternalLink } from "lucide-react";
import { isGoogleMapsConfigured, loadGoogleMaps, mapsSearchUrl } from "@/lib/google-maps";
import { MapPreview } from "@/components/map-preview";

export type AddressValue = {
  address: string;
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  formatted_address: string | null;
};

type Props = {
  label?: string;
  placeholder?: string;
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  showPreview?: boolean;
  className?: string;
};

type Suggestion = { id: string; text: string; placeId: string };

export function AddressAutocomplete({
  label,
  placeholder,
  value,
  onChange,
  showPreview = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const configured = isGoogleMapsConfigured();
  const mapUrl = useMemo(
    () => mapsSearchUrl({ query: value.formatted_address || value.address, placeId: value.place_id, lat: value.lat, lng: value.lng }),
    [value.address, value.formatted_address, value.place_id, value.lat, value.lng],
  );

  // Close on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const runFetch = (input: string) => {
    if (!configured || input.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    loadGoogleMaps().then(async (google) => {
      const places = await google.maps.importLibrary("places");
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new places.AutocompleteSessionToken();
      }
      try {
        const { suggestions: raw } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input,
          sessionToken: sessionTokenRef.current,
        });
        const mapped: Suggestion[] = (raw ?? [])
          .map((s: any) => {
            const p = s.placePrediction;
            if (!p) return null;
            return {
              id: p.placeId ?? Math.random().toString(36),
              placeId: p.placeId,
              text: p.text?.toString?.() ?? p.text ?? "",
            };
          })
          .filter(Boolean) as Suggestion[];
        setSuggestions(mapped);
        setOpen(mapped.length > 0);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }).catch(() => setLoading(false));
  };

  const handleInput = (text: string) => {
    onChange({ ...value, address: text, place_id: null, lat: null, lng: null, formatted_address: null });
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => runFetch(text), 250);
  };

  const pick = async (s: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    try {
      const google = await loadGoogleMaps();
      const places = await google.maps.importLibrary("places");
      const place = new places.Place({ id: s.placeId });
      await place.fetchFields({ fields: ["location", "formattedAddress", "displayName"] });
      const loc = place.location;
      onChange({
        address: place.formattedAddress ?? s.text,
        formatted_address: place.formattedAddress ?? s.text,
        place_id: s.placeId,
        lat: loc ? loc.lat() : null,
        lng: loc ? loc.lng() : null,
      });
      // Rotate session token after a selection (per Places API guidance)
      sessionTokenRef.current = null;
    } catch {
      onChange({ ...value, address: s.text, place_id: s.placeId, formatted_address: s.text });
    }
  };

  return (
    <div className={className} ref={wrapRef}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <div className="flex gap-2">
          <Input
            value={value.address}
            onChange={(e) => handleInput(e.target.value)}
            onFocus={() => { if (suggestions.length) setOpen(true); }}
            placeholder={placeholder ?? "Start typing an address…"}
          />
          {mapUrl && (
            <Button asChild type="button" variant="outline" size="icon" title="Open in Google Maps">
              <a href={mapUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
        {open && suggestions.length > 0 && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-auto">
            {suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <span>{s.text}</span>
              </button>
            ))}
          </div>
        )}
        {loading && (
          <p className="absolute right-12 top-2 text-xs text-muted-foreground">…</p>
        )}
      </div>
      {!configured && (
        <p className="text-xs text-muted-foreground mt-1">
          Google Maps not configured — free-form address only.
        </p>
      )}
      {showPreview && (value.lat != null || value.address) && (
        <div className="mt-2">
          <MapPreview lat={value.lat} lng={value.lng} query={value.formatted_address || value.address} />
        </div>
      )}
    </div>
  );
}
