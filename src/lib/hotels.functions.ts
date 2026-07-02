import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HotelSearchResult = {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  lat: number | null;
  lng: number | null;
  price: number | null;
  currency: string;
  review_score: number | null;
  review_count: number | null;
  photo: string | null;
};

const BASE = "https://booking-com15.p.rapidapi.com/api/v1";
const HOST = "booking-com15.p.rapidapi.com";

async function bookingFetch(path: string, apiKey: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-RapidAPI-Key": apiKey, "X-RapidAPI-Host": HOST },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Booking.com error", res.status, path, body);
    throw new Error(`Booking.com lookup failed (${res.status})`);
  }
  return res.json() as Promise<any>;
}

export const searchHotels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      query: string;
      checkIn: string;
      checkOut: string;
      adults?: number;
      currency?: string;
    }) => {
      const query = String(input?.query ?? "").trim();
      const checkIn = String(input?.checkIn ?? "").trim();
      const checkOut = String(input?.checkOut ?? "").trim();
      if (!query) throw new Error("Enter a city or hotel name");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn)) throw new Error("Check-in date required");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) throw new Error("Check-out date required");
      if (checkOut <= checkIn) throw new Error("Check-out must be after check-in");
      return {
        query,
        checkIn,
        checkOut,
        adults: Math.max(1, Math.min(8, Number(input?.adults ?? 1))),
        currency: String(input?.currency ?? "GBP").toUpperCase().slice(0, 3),
      };
    }
  )
  .handler(async ({ data }): Promise<HotelSearchResult[]> => {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) throw new Error("Hotel lookup is not configured (missing RAPIDAPI_KEY)");

    // 1) Resolve destination
    const destJson = await bookingFetch(
      `/hotels/searchDestination?query=${encodeURIComponent(data.query)}`,
      apiKey
    );
    const dest = Array.isArray(destJson?.data) ? destJson.data[0] : null;
    if (!dest?.dest_id) throw new Error(`No destination found for "${data.query}"`);

    // 2) Search hotels
    const params = new URLSearchParams({
      dest_id: String(dest.dest_id),
      search_type: String(dest.search_type ?? "CITY"),
      arrival_date: data.checkIn,
      departure_date: data.checkOut,
      adults: String(data.adults),
      room_qty: "1",
      page_number: "1",
      units: "metric",
      temperature_unit: "c",
      languagecode: "en-us",
      currency_code: data.currency,
    });
    const searchJson = await bookingFetch(`/hotels/searchHotels?${params.toString()}`, apiKey);
    const hotels: any[] = searchJson?.data?.hotels ?? [];

    return hotels.slice(0, 20).map((h) => {
      const p = h.property ?? {};
      const priceBreakdown = p.priceBreakdown ?? {};
      const gross = priceBreakdown.grossPrice ?? priceBreakdown.strikethroughPrice ?? {};
      return {
        id: String(h.hotel_id ?? p.id ?? crypto.randomUUID()),
        name: String(p.name ?? h.accessibilityLabel ?? "Unnamed hotel"),
        address: String(p.wishlistName ?? dest.name ?? ""),
        city: String(dest.city_name ?? dest.name ?? ""),
        country: String(dest.country ?? ""),
        lat: typeof p.latitude === "number" ? p.latitude : null,
        lng: typeof p.longitude === "number" ? p.longitude : null,
        price: typeof gross.value === "number" ? Math.round(gross.value) : null,
        currency: String(gross.currency ?? data.currency),
        review_score: typeof p.reviewScore === "number" ? p.reviewScore : null,
        review_count: typeof p.reviewCount === "number" ? p.reviewCount : null,
        photo: Array.isArray(p.photoUrls) && p.photoUrls[0] ? String(p.photoUrls[0]) : null,
      };
    });
  });
