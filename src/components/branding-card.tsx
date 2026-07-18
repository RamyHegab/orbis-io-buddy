import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { extractPaletteFromImage } from "@/components/branding-provider";
import { toast } from "sonner";
import { Upload, Trash2, Crop, ArrowLeftRight, RotateCcw } from "lucide-react";
import { LogoEditorDialog } from "@/components/logo-editor-dialog";
import { BrandingPreview } from "@/components/branding-preview";

type ThemeMode = "default" | "from_logo" | "custom";

export function BrandingCard() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("logo_url, logo_path, theme_mode, theme_primary, theme_accent, theme_sidebar")
        .eq("id", 1)
        .maybeSingle();
      return data;
    },
  });

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>("default");
  const [primary, setPrimary] = useState<string>("#26314f");
  const [accent, setAccent] = useState<string>("#c9a34a");
  const [sidebar, setSidebar] = useState<string>("#1e2545");

  useEffect(() => {
    if (!data) return;
    setLogoUrl(data.logo_url);
    setLogoPath(data.logo_path);
    setMode((data.theme_mode as ThemeMode) ?? "default");
    if (data.theme_primary) setPrimary(data.theme_primary);
    if (data.theme_accent) setAccent(data.theme_accent);
    if (data.theme_sidebar) setSidebar(data.theme_sidebar);
  }, [data]);

  const [editorFile, setEditorFile] = useState<File | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [suggested, setSuggested] = useState<{ a: string; b: string } | null>(null);

  const uploadLogo = async (file: File | Blob, suggestedName?: string) => {
    const nameFromFile = (file as File).name;
    const baseName = suggestedName ?? nameFromFile ?? "logo.png";
    const ext = baseName.split(".").pop() || "png";
    const path = `logo-${Date.now()}.${ext}`;
    const contentType = (file as any).type || "image/png";
    const { error } = await supabase.storage.from("branding").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType,
    });
    if (error) throw error;
    const { data: signed, error: sErr } = await supabase.storage
      .from("branding")
      .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    if (sErr) throw sErr;
    if (logoPath && logoPath !== path) {
      await supabase.storage.from("branding").remove([logoPath]);
    }
    setLogoUrl(signed.signedUrl);
    setLogoPath(path);
    // Always suggest a palette after upload
    const palette = await extractPaletteFromImage(signed.signedUrl);
    if (palette) {
      setSuggested({ a: palette.primary, b: palette.accent });
      if (mode !== "custom") {
        setMode("from_logo");
        setPrimary(palette.primary);
        setAccent(palette.accent);
      }
    }
    toast.success("Logo uploaded — pick your Primary and Accent below");
  };

  const removeLogo = async () => {
    if (logoPath) await supabase.storage.from("branding").remove([logoPath]);
    setLogoUrl(null);
    setLogoPath(null);
    toast.success("Logo removed");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        id: 1,
        logo_url: logoUrl,
        logo_path: logoPath,
        theme_mode: mode,
        theme_primary: mode === "default" ? null : primary,
        theme_accent: mode === "default" ? null : accent,
        theme_sidebar: mode === "custom" ? sidebar : null,
      };
      const { error } = await supabase.from("app_settings").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Branding saved");
      qc.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const reset = useMutation({
    mutationFn: async () => {
      if (logoPath) await supabase.storage.from("branding").remove([logoPath]);
      const { error } = await supabase.from("app_settings").upsert({
        id: 1,
        logo_url: null,
        logo_path: null,
        theme_mode: "default",
        theme_primary: null,
        theme_accent: null,
        theme_sidebar: null,
      }, { onConflict: "id" });
      if (error) throw error;
      setLogoUrl(null); setLogoPath(null); setMode("default");
    },
    onSuccess: () => {
      toast.success("Reverted to default");
      qc.invalidateQueries({ queryKey: ["branding"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deriveNow = async () => {
    if (!logoUrl) { toast.error("Upload a logo first"); return; }
    const palette = await extractPaletteFromImage(logoUrl);
    if (!palette) { toast.error("Couldn't read colours from logo"); return; }
    setPrimary(palette.primary);
    setAccent(palette.accent);
    toast.success("Colours picked from logo");
  };

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Branding — Logo & theme</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label className="mb-2 block">University logo</Label>
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 rounded-md border bg-white flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setEditorFile(f);
                    setEditorOpen(true);
                  }
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-1" /> Upload
              </Button>
              {logoUrl && (
                <>
                  <Button variant="outline" size="sm" onClick={async () => {
                    try {
                      const r = await fetch(logoUrl);
                      const b = await r.blob();
                      const f = new File([b], "current-logo.png", { type: b.type || "image/png" });
                      setEditorFile(f);
                      setEditorOpen(true);
                    } catch { toast.error("Couldn't load current logo"); }
                  }}>
                    <Crop className="h-4 w-4 mr-1" /> Re-crop
                  </Button>
                  <Button variant="ghost" size="sm" onClick={removeLogo}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-2 block">Colour scheme</Label>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)} className="space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="default" id="mode-default" className="mt-1" />
              <div><div className="text-sm font-medium">Use default theme</div><div className="text-xs text-muted-foreground">Orbis navy & gold.</div></div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="from_logo" id="mode-from-logo" className="mt-1" />
              <div className="flex-1">
                <div className="text-sm font-medium">Derive colours from logo</div>
                <div className="text-xs text-muted-foreground">Auto-picks primary and accent from the uploaded logo.</div>
                {mode === "from_logo" && (
                  <Button size="sm" variant="outline" className="mt-2" onClick={deriveNow} disabled={!logoUrl}>
                    Pick colours from logo now
                  </Button>
                )}
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <RadioGroupItem value="custom" id="mode-custom" className="mt-1" />
              <div><div className="text-sm font-medium">Custom colours</div><div className="text-xs text-muted-foreground">Set your own primary, accent and sidebar.</div></div>
            </label>
          </RadioGroup>
        </div>

        {suggested && mode !== "default" && (
          <div className="rounded-md border p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium">Suggested from your logo</div>
              <Button size="sm" variant="outline" onClick={() => {
                setPrimary(accent);
                setAccent(primary);
              }}>
                <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Swap Primary / Accent
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[suggested.a, suggested.b].map((hex) => {
                const isPrimary = hex.toLowerCase() === primary.toLowerCase();
                const isAccent = hex.toLowerCase() === accent.toLowerCase();
                return (
                  <div key={hex} className="flex items-center gap-2 rounded border bg-background p-2">
                    <div className="h-8 w-8 rounded border shrink-0" style={{ background: hex }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs">{hex.toUpperCase()}</div>
                      <div className="flex gap-1 mt-1">
                        <Button
                          size="sm"
                          variant={isPrimary ? "default" : "outline"}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => { if (accent.toLowerCase() === hex.toLowerCase()) setAccent(primary); setPrimary(hex); }}
                        >
                          Primary
                        </Button>
                        <Button
                          size="sm"
                          variant={isAccent ? "default" : "outline"}
                          className="h-6 px-2 text-[10px]"
                          onClick={() => { if (primary.toLowerCase() === hex.toLowerCase()) setPrimary(accent); setAccent(hex); }}
                        >
                          Accent
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Primary replaces navy across the app. Accent replaces gold highlights.
            </p>
          </div>
        )}

        {mode !== "default" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <ColourPicker label="Primary" value={primary} onChange={setPrimary} />
            <ColourPicker label="Accent" value={accent} onChange={setAccent} />
            {mode === "custom" && <ColourPicker label="Sidebar" value={sidebar} onChange={setSidebar} />}
          </div>
        )}

        <BrandingPreview
          logoUrl={logoUrl}
          mode={mode}
          primary={primary}
          accent={accent}
          sidebar={sidebar}
        />

        <div className="flex flex-wrap justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="border-2 border-gold text-gold hover:bg-gold/10 hover:text-gold"
          >
            <RotateCcw className="h-4 w-4 mr-1" /> Reset to default
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save branding"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Changes apply immediately after saving. Use “Reset to default” to revert at any time.
        </p>
      </CardContent>
      <LogoEditorDialog
        file={editorFile}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        onApply={async (blob, filename) => {
          try { await uploadLogo(blob, filename); } catch (err: any) { toast.error(err.message); }
        }}
      />
    </Card>
  );
}

function ColourPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border cursor-pointer"
        />
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono text-sm" />
      </div>
    </div>
  );
}
