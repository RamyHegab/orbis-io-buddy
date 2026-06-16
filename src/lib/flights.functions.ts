import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FlightLookupResult = {
  airline: string;
  flight_number: string;
  from_city: string;
  from_country: string;
  to_city: string;
  to_country: string;
  start_time: string; // HH:MM
  end_time: string; // HH:MM
  end_date: string; // YYYY-MM-DD
};

export const lookupFlight = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { flightNumber: string; date: string }) => {
    const flightNumber = String(input?.flightNumber ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const date = String(input?.date ?? "").trim();
    if (!flightNumber) throw new Error("Flight number is required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Valid date (YYYY-MM-DD) is required");
    return { flightNumber, date };
  })
  .handler(async ({ data }): Promise<FlightLookupResult> => {
    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) throw new Error("Flight lookup is not configured (missing RAPIDAPI_KEY)");

    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(data.flightNumber)}/${data.date}?withAircraftImage=false&withLocation=false`;
    const res = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
    });

    if (res.status === 204 || res.status === 404) {
      throw new Error(`No flight found for ${data.flightNumber} on ${data.date}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("AeroDataBox error", res.status, body);
      throw new Error(`Flight lookup failed (${res.status})`);
    }

    const json = (await res.json()) as any;
    const flights = Array.isArray(json) ? json : [json];
    const flight = flights[0];
    if (!flight) throw new Error(`No flight found for ${data.flightNumber} on ${data.date}`);

    const dep = flight.departure ?? {};
    const arr = flight.arrival ?? {};
    const depAirport = dep.airport ?? {};
    const arrAirport = arr.airport ?? {};

    const depLocal: string | undefined =
      dep.scheduledTime?.local ?? dep.revisedTime?.local ?? dep.predictedTime?.local;
    const arrLocal: string | undefined =
      arr.scheduledTime?.local ?? arr.revisedTime?.local ?? arr.predictedTime?.local;

    // Format "YYYY-MM-DD HH:MM[+TZ]" → date and time
    const parseLocal = (s?: string) => {
      if (!s) return { date: "", time: "" };
      const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
      return m ? { date: m[1], time: m[2] } : { date: "", time: "" };
    };

    const depParts = parseLocal(depLocal);
    const arrParts = parseLocal(arrLocal);

    const airline: string =
      flight.airline?.name ?? flight.airline?.shortName ?? flight.airline?.iata ?? "";

    return {
      airline,
      flight_number: flight.number ?? data.flightNumber,
      from_city: depAirport.municipalityName ?? depAirport.shortName ?? depAirport.iata ?? "",
      from_country: depAirport.countryCode ?? "",
      to_city: arrAirport.municipalityName ?? arrAirport.shortName ?? arrAirport.iata ?? "",
      to_country: arrAirport.countryCode ?? "",
      start_time: depParts.time,
      end_time: arrParts.time,
      end_date: arrParts.date,
    };
  });
