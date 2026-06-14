import jsPDF from "jspdf";

type Ctx = {
  doc: jsPDF;
  x: number;
  y: number;
  width: number;
  bottom: number;
  lineH: number;
};

function ensureSpace(c: Ctx, need: number) {
  if (c.y + need > c.bottom) {
    c.doc.addPage();
    c.y = 20;
  }
}

/** Render a small subset of markdown (h1-h3, paragraphs, bullets, numbered lists, bold/italic inline). */
export function renderMarkdownToPdf(
  doc: jsPDF,
  markdown: string,
  opts: { x?: number; y?: number; width?: number; bottom?: number } = {},
) {
  const c: Ctx = {
    doc,
    x: opts.x ?? 14,
    y: opts.y ?? 20,
    width: opts.width ?? 182,
    bottom: opts.bottom ?? 280,
    lineH: 5,
  };

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");

  const writeWrapped = (text: string, font: "normal" | "bold" | "italic", size: number, indent = 0, prefix = "") => {
    doc.setFont("helvetica", font);
    doc.setFontSize(size);
    const lh = size * 0.42;
    const avail = c.width - indent;
    const wrapped = doc.splitTextToSize(prefix + stripInline(text), avail);
    ensureSpace(c, wrapped.length * lh + 1);
    doc.text(wrapped, c.x + indent, c.y);
    c.y += wrapped.length * lh + 1;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    if (!line.trim()) {
      c.y += 2;
      continue;
    }

    // Horizontal rule
    if (/^\s*---+\s*$/.test(line)) {
      ensureSpace(c, 4);
      doc.setDrawColor(200);
      doc.line(c.x, c.y, c.x + c.width, c.y);
      c.y += 4;
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const size = level === 1 ? 16 : level === 2 ? 13 : level === 3 ? 11 : 10;
      c.y += level <= 2 ? 3 : 1;
      writeWrapped(h[2], "bold", size);
      continue;
    }

    // Bullets
    const b = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (b) {
      writeWrapped(b[1], "normal", 10, 4, "• ");
      continue;
    }

    // Numbered list
    const n = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (n) {
      writeWrapped(n[2], "normal", 10, 6, `${n[1]}. `);
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      writeWrapped(line.replace(/^\s*>\s?/, ""), "italic", 10, 4);
      continue;
    }

    // Paragraph
    writeWrapped(line, "normal", 10);
  }

  return c.y;
}

function stripInline(s: string) {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/_(.+?)_/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
}
