// Loads the Google Maps JS API once. Uses the referrer-restricted browser key
// from the Lovable Google Maps Platform connector. Safe to call multiple times.

declare global {
  interface Window {
    google?: any;
    __lovableGmapsInit?: () => void;
  }
}

let loadPromise: Promise<any> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return Boolean(import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY);
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser"));
  }
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google);
  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;
  if (!key) return Promise.reject(new Error("Google Maps key not configured"));

  loadPromise = new Promise((resolve, reject) => {
    window.__lovableGmapsInit = () => resolve(window.google);
    const params = new URLSearchParams({
      key,
      loading: "async",
      libraries: "places,marker",
      callback: "__lovableGmapsInit",
      v: "weekly",
    });
    if (channel) params.set("channel", channel);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("Failed to load Google Maps script"));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}

export function mapsSearchUrl(opts: { query?: string | null; placeId?: string | null; lat?: number | null; lng?: number | null }): string | null {
  if (opts.placeId && opts.query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.query)}&query_place_id=${encodeURIComponent(opts.placeId)}`;
  }
  if (opts.lat != null && opts.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${opts.lat},${opts.lng}`;
  }
  if (opts.query) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(opts.query)}`;
  }
  return null;
}
