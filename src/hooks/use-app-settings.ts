import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppSettings = {
  cycle_start_month: number;
  cycle_start_year: number;
  cycle_end_month: number;
  cycle_end_year: number;
  currency: string;
};

const DEFAULTS: AppSettings = {
  cycle_start_month: 9,
  cycle_start_year: new Date().getFullYear(),
  cycle_end_month: 8,
  cycle_end_year: new Date().getFullYear() + 1,
  currency: "GBP",
};

export function useAppSettings() {
  const q = useQuery({
    queryKey: ["app_settings"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<AppSettings> => {
      const { data } = await supabase
        .from("app_settings")
        .select("cycle_start_month, cycle_start_year, cycle_end_month, cycle_end_year, currency")
        .eq("id", 1)
        .maybeSingle();
      return { ...DEFAULTS, ...(data ?? {}) };
    },
  });
  return q.data ?? DEFAULTS;
}
