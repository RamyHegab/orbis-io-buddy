import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

type AspectKey = "square" | "wide" | "tall" | "original";
type SizePreset = 128 | 256 | 512 | 1024;

const ASPECTS: Record<AspectKey, { label: string; ratio: number | null; hint: string }> = {
  square: { label: "Square 1:1", ratio: 1, hint: "Best for avatars, sidebar, favicons" },
  wide: { label: "Wide 4:1", ratio: 4, hint: "Best for headers / email banners" },
  tall: { label: "Portrait 3:4", ratio: 3 / 4, hint: "For portrait marks" },
  original: { label: "Original", ratio: null, hint: "Keep the source aspect" },
};

export function LogoEditorDialog({
  file,
  open,
  onOpenChange,
  onApply,
}: {
  file: File | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onApply: (blob: Blob, filename: string) => Promise<void> | void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const [aspect, setAspect] = useState<AspectKey>("square");
  const [size, setSize] = useState<SizePreset>(512);
  const [zoom, setZoom] = useState(1); // 1 = fit
  const [offset, setOffset] = useState({ x: 0, y: 0 }); // in image px, centre of crop
  const [bg, setBg] = useState<"transparent" | "white">("transparent");
  const [busy, setBusy] = useState(false);

  // load file
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgUrl(url);
    const im = new Image();
    im.onload = () => {
      setImgSize({ w: im.naturalWidth, h: im.naturalHeight });
      setZoom(1);
      setOffset({ x: im.naturalWidth / 2, y: im.naturalHeight / 2 });
    };
    im.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // reset offset when aspect changes
  useEffect(() => {
    if (imgSize.w) setOffset({ x: imgSize.w / 2, y: imgSize.h / 2 });
  }, [aspect, imgSize.w, imgSize.h]);

  const cropRect = useMemo(() => {
    // Compute the crop rectangle (in image pixels) given aspect + zoom
    const ratio = ASPECTS[aspect].ratio;
    if (!imgSize.w) return { w: 0, h: 0, x: 0, y: 0 };
    if (ratio == null) return { w: imgSize.w, h: imgSize.h, x: 0, y: 0 };
    // Base crop = largest rect of given ratio that fits inside image
    let baseW: number, baseH: number;
    if (imgSize.w / imgSize.h > ratio) {
      baseH = imgSize.h;
      baseW = imgSize.h * ratio;
    } else {
      baseW = imgSize.w;
      baseH = imgSize.w / ratio;
    }
    const w = baseW / zoom;
    const h = baseH / zoom;
    let x = offset.x - w / 2;
    let y = offset.y - h / 2;
    x = Math.max(0, Math.min(imgSize.w - w, x));
    y = Math.max(0, Math.min(imgSize.h - h, y));
    return { w, h, x, y };
  }, [aspect, zoom, offset, imgSize]);

  const previewRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current || !previewRef.current || !imgSize.w) return;
    const rect = previewRef.current.getBoundingClientRect();
    // scale = displayed / image
    const displayedScale = Math.min(rect.width / imgSize.w, rect.height / imgSize.h);
    const dx = (e.clientX - dragRef.current.sx) / displayedScale;
    const dy = (e.clientY - dragRef.current.sy) / displayedScale;
    setOffset({ x: dragRef.current.ox - dx, y: dragRef.current.oy - dy });
  };
  const onPointerUp = () => { dragRef.current = null; };

  const apply = async () => {
    if (!imgRef.current || !imgSize.w) return;
    setBusy(true);
    try {
      const ratio = ASPECTS[aspect].ratio ?? imgSize.w / imgSize.h;
      const outW = size;
      const outH = Math.round(size / ratio);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d")!;
      if (bg === "white") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, outW, outH);
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        imgRef.current,
        cropRect.x, cropRect.y, cropRect.w, cropRect.h,
        0, 0, outW, outH,
      );
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("Failed to render"))), "image/png", 0.95),
      );
      const filename = `logo-${aspect}-${outW}x${outH}.png`;
      await onApply(blob, filename);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to process logo");
    } finally {
      setBusy(false);
    }
  };

  // preview crop overlay geometry (in %)
  const overlay = useMemo(() => {
    if (!imgSize.w) return null;
    return {
      left: `${(cropRect.x / imgSize.w) * 100}%`,
      top: `${(cropRect.y / imgSize.h) * 100}%`,
      width: `${(cropRect.w / imgSize.w) * 100}%`,
      height: `${(cropRect.h / imgSize.h) * 100}%`,
    };
  }, [cropRect, imgSize]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Crop & resize logo</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1fr_240px]">
          <div
            ref={previewRef}
            className="relative bg-[conic-gradient(#eee_25%,#fff_0_50%,#eee_0_75%,#fff_0)] bg-[length:16px_16px] border rounded-md overflow-hidden select-none touch-none"
            style={{ aspectRatio: imgSize.w && imgSize.h ? `${imgSize.w} / ${imgSize.h}` : "1 / 1", maxHeight: 420 }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="logo source"
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                crossOrigin="anonymous"
              />
            )}
            {overlay && (
              <>
                {/* dark mask outside crop */}
                <div className="absolute inset-0 pointer-events-none" style={{
                  background:
                    `linear-gradient(rgba(0,0,0,.45),rgba(0,0,0,.45))`,
                  clipPath: `polygon(
                    0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                    ${overlay.left} ${overlay.top},
                    ${overlay.left} calc(${overlay.top} + ${overlay.height}),
                    calc(${overlay.left} + ${overlay.width}) calc(${overlay.top} + ${overlay.height}),
                    calc(${overlay.left} + ${overlay.width}) ${overlay.top},
                    ${overlay.left} ${overlay.top}
                  )`,
                }} />
                <div
                  className="absolute border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)] pointer-events-none"
                  style={overlay}
                />
              </>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs">Aspect / shape</Label>
              <Select value={aspect} onValueChange={(v) => setAspect(v as AspectKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ASPECTS) as AspectKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{ASPECTS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">{ASPECTS[aspect].hint}</p>
            </div>

            <div>
              <Label className="text-xs">Output size</Label>
              <Select value={String(size)} onValueChange={(v) => setSize(Number(v) as SizePreset)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="128">128 px — favicon / small icon</SelectItem>
                  <SelectItem value="256">256 px — sidebar / avatar</SelectItem>
                  <SelectItem value="512">512 px — recommended</SelectItem>
                  <SelectItem value="1024">1024 px — hi-res / print</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Zoom</Label>
              <Slider min={1} max={4} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
            </div>

            <div>
              <Label className="text-xs">Background</Label>
              <RadioGroup value={bg} onValueChange={(v) => setBg(v as any)} className="flex gap-3 mt-1">
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <RadioGroupItem value="transparent" /> Transparent
                </label>
                <label className="flex items-center gap-1 text-sm cursor-pointer">
                  <RadioGroupItem value="white" /> White
                </label>
              </RadioGroup>
            </div>

            <p className="text-[11px] text-muted-foreground">Drag the preview to reposition the crop.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={apply} disabled={busy || !imgSize.w}>{busy ? "Processing…" : "Apply & upload"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
