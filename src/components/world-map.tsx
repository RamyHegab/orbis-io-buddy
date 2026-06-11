import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import worldData from "@/assets/world-countries-110m.json";

export type CountryStats = {
  agents: number;
  schools: number;
  trips: number;
};

type Props = {
  data: Record<string, CountryStats>;
};

// Normalize names for matching (topojson uses common English names).
const ALIASES: Record<string, string> = {
  "uk": "united kingdom",
  "u.k.": "united kingdom",
  "great britain": "united kingdom",
  "england": "united kingdom",
  "scotland": "united kingdom",
  "wales": "united kingdom",
  "northern ireland": "united kingdom",
  "usa": "united states of america",
  "u.s.a.": "united states of america",
  "united states": "united states of america",
  "us": "united states of america",
  "uae": "united arab emirates",
  "south korea": "south korea",
  "korea": "south korea",
  "republic of korea": "south korea",
  "russia": "russia",
  "russian federation": "russia",
  "czech republic": "czechia",
  "ivory coast": "côte d'ivoire",
  "vietnam": "vietnam",
  "viet nam": "vietnam",
  "tanzania": "united republic of tanzania",
  "congo": "republic of the congo",
  "drc": "democratic republic of the congo",
  "dr congo": "democratic republic of the congo",
};

export function normalizeCountry(name: string | null | undefined): string {
  if (!name) return "";
  const k = name.trim().toLowerCase();
  return ALIASES[k] ?? k;
}

export function WorldMap({ data }: Props) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    name: string;
    stats: CountryStats | null;
  } | null>(null);

  // Build lookup by normalized name.
  const normalized = useMemo(() => {
    const out: Record<string, CountryStats> = {};
    for (const [k, v] of Object.entries(data)) {
      out[normalizeCountry(k)] = v;
    }
    return out;
  }, [data]);

  return (
    <div className="relative w-full">
      <ComposableMap
        projection="geoEqualEarth"
        projectionConfig={{ scale: 155 }}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={worldData as any}>
          {({ geographies }: { geographies: any[] }) =>
            geographies.map((geo) => {
              const name = geo.properties?.name as string;
              const stats = normalized[normalizeCountry(name)] ?? null;
              const has = !!stats && (stats.agents + stats.schools + stats.trips > 0);
              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  onMouseEnter={(evt) => {
                    setTooltip({
                      x: evt.clientX,
                      y: evt.clientY,
                      name,
                      stats,
                    });
                  }}
                  onMouseMove={(evt) => {
                    setTooltip((t) =>
                      t ? { ...t, x: evt.clientX, y: evt.clientY } : t,
                    );
                  }}
                  onMouseLeave={() => setTooltip(null)}
                  style={{
                    default: {
                      fill: has ? "var(--gold)" : "var(--muted)",
                      stroke: "var(--primary)",
                      strokeWidth: 0.4,
                      outline: "none",
                    },
                    hover: {
                      fill: "var(--primary)",
                      stroke: "var(--gold)",
                      strokeWidth: 0.8,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: {
                      fill: "var(--primary)",
                      outline: "none",
                    },
                  }}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 rounded-md border-2 border-primary bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: tooltip.x + 12,
            top: tooltip.y + 12,
          }}
        >
          <div className="font-semibold text-primary mb-1">{tooltip.name}</div>
          {tooltip.stats ? (
            <div className="space-y-0.5 text-foreground">
              <div>
                <span className="text-muted-foreground">Agents:</span>{" "}
                <span className="font-medium">{tooltip.stats.agents}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Schools:</span>{" "}
                <span className="font-medium">{tooltip.stats.schools}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Trips:</span>{" "}
                <span className="font-medium">{tooltip.stats.trips}</span>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground italic">No activity</div>
          )}
        </div>
      )}
    </div>
  );
}
