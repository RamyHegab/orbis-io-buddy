import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Share2, Copy, ExternalLink, Download, MessageCircle, Mail, Send } from "lucide-react";
import { toast } from "sonner";

interface Props {
  url: string;
  title: string;
}

export function ShareFormButton({ url, title }: Props) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 260, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${title.replace(/[^\w-]+/g, "_")}-qr.png`;
    a.click();
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      /* user cancelled */
    }
  }

  const text = encodeURIComponent(`${title}: ${url}`);
  const wa = `https://wa.me/?text=${text}`;
  const mail = `mailto:?subject=${encodeURIComponent(title)}&body=${text}`;
  const tg = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Share2 className="h-4 w-4 mr-1.5" /> Share
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium">{title}</div>
          <div className="flex flex-col items-center gap-2 rounded-md border bg-muted/30 p-3">
            {dataUrl ? (
              <img src={dataUrl} alt="QR code" className="h-44 w-44" />
            ) : (
              <canvas ref={canvasRef} className="h-44 w-44" />
            )}
            <Button size="sm" variant="ghost" onClick={download} disabled={!dataUrl}>
              <Download className="h-4 w-4 mr-1.5" /> Download QR
            </Button>
          </div>
          <div className="flex gap-1.5">
            <Input value={url} readOnly className="h-8 text-xs" />
            <Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button size="sm" variant="outline" asChild>
              <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp</a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={mail}><Mail className="h-4 w-4 mr-1.5" /> Email</a>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a href={tg} target="_blank" rel="noreferrer"><Send className="h-4 w-4 mr-1.5" /> Telegram</a>
            </Button>
            {canNativeShare && (
              <Button size="sm" variant="outline" onClick={nativeShare}>
                <Share2 className="h-4 w-4 mr-1.5" /> More…
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
