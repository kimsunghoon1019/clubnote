import {
  AlignmentType,
  BorderStyle,
  Document,
  HeightRule,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type FileChild,
} from "docx";
import { compareTxAsc } from "./bankExcel";
import { dataUrlToBlob, downloadBlob, proofKind, txProofs } from "./proof";
import { getStoredProofBlob, peekProofBlob } from "./proofDb";
import {
  formatProofPeriodLine,
  periodDateBounds,
  proofLabel,
  proofNumberById,
  proofsDocFileName,
} from "./financeExport";
import type { DuesSemester } from "./dues";
import type { Transaction, TxProof } from "./types";

const A4_W = 11906;
const A4_H = 16838;
const MARGIN = 720;
const CONTENT_W = A4_W - MARGIN * 2;
const COL_W = Math.floor(CONTENT_W / 2);
const HEAD_H = 400;
const PAGE1_CHROME = 1500;
const PAGE_GAP = 80;
const CELL_PAD = 80;
const FONT = "Malgun Gothic";

const BLACK = { style: BorderStyle.SINGLE, size: 12, color: "000000" };
const NONE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const BORDERS = { top: BLACK, bottom: BLACK, left: BLACK, right: BLACK };
const TABLE_BORDERS = {
  top: NONE,
  bottom: NONE,
  left: NONE,
  right: NONE,
  insideHorizontal: NONE,
  insideVertical: NONE,
};

type Raster = { data: Uint8Array; width: number; height: number };

type ProofItem = {
  label: string;
  rasters: Raster[];
};

export async function downloadProofsDocx(
  rows: Transaction[],
  period: string,
  range: Pick<DuesSemester, "start" | "end"> | null,
) {
  if (rows.length === 0) {
    throw new Error("내보낼 거래가 없어요");
  }
  const numbered = proofNumberById(rows);
  const items: ProofItem[] = [];
  for (const row of [...rows].sort(compareTxAsc)) {
    const n = numbered.get(row.id);
    if (!n) continue;
    const rasters: Raster[] = [];
    for (const proof of txProofs(row)) {
      const raster = await rasterizeProof(row, proof);
      if (raster) rasters.push(raster);
    }
    items.push({ label: proofLabel(n), rasters });
  }

  const bounds = periodDateBounds(rows, range);
  const children: FileChild[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      border: {
        bottom: { style: BorderStyle.THICK, size: 18, color: "000000", space: 1 },
      },
      indent: { left: 1800, right: 1800 },
      children: [new TextRun({ text: "결산 내역 증빙자료", bold: true, size: 36, font: FONT })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 280 },
      children: [
        new TextRun({
          text: formatProofPeriodLine(bounds.start, bounds.end),
          size: 22,
          font: FONT,
        }),
      ],
    }),
  ];

  const page1Body = A4_H - MARGIN * 2 - PAGE1_CHROME - HEAD_H;
  const laterBody = A4_H - MARGIN * 2 - HEAD_H - PAGE_GAP;

  for (let i = 0; i < items.length; i += 2) {
    const first = i === 0;
    if (!first) {
      children.push(new Paragraph({ children: [], pageBreakBefore: true, spacing: { after: PAGE_GAP } }));
    }
    children.push(proofPairTable(items[i], items[i + 1], first ? page1Body : laterBody));
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: A4_H },
            margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, proofsDocFileName(period));
}

function proofPairTable(left: ProofItem, right: ProofItem | undefined, bodyDxa: number) {
  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_W, COL_W],
    layout: TableLayoutType.FIXED,
    borders: TABLE_BORDERS,
    rows: [
      new TableRow({
        cantSplit: true,
        tableHeader: true,
        height: { value: HEAD_H, rule: HeightRule.EXACT },
        children: [headerCell(left.label), headerCell(right?.label ?? "")],
      }),
      new TableRow({
        cantSplit: true,
        height: { value: Math.max(2400, bodyDxa), rule: HeightRule.EXACT },
        children: [bodyCell(left, bodyDxa), bodyCell(right, bodyDxa)],
      }),
    ],
  });
}

function headerCell(text: string) {
  return new TableCell({
    borders: BORDERS,
    width: { size: COL_W, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: { fill: "F2F4F6", type: ShadingType.CLEAR },
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: true, size: 22, font: FONT })],
      }),
    ],
  });
}

function bodyCell(item: ProofItem | undefined, bodyDxa: number) {
  if (!item || item.rasters.length === 0) {
    return new TableCell({
      borders: BORDERS,
      width: { size: COL_W, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: CELL_PAD, bottom: CELL_PAD, left: CELL_PAD, right: CELL_PAD },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: item
            ? [new TextRun({ text: "증빙없음", size: 22, font: FONT, color: "8B95A1" })]
            : [],
        }),
      ],
    });
  }

  const innerW = COL_W - CELL_PAD * 2;
  const innerH = Math.max(400, bodyDxa - CELL_PAD * 2);
  const fitted = fitRasters(item.rasters, innerW, innerH);
  return new TableCell({
    borders: BORDERS,
    width: { size: COL_W, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    margins: { top: CELL_PAD, bottom: CELL_PAD, left: CELL_PAD, right: CELL_PAD },
    children: fitted.map(
      (img) =>
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new ImageRun({
              type: "png",
              data: img.data,
              transformation: { width: img.width, height: img.height },
              altText: { name: "증빙", description: "증빙 자료", title: "증빙" },
            }),
          ],
        }),
    ),
  });
}

function fitRasters(rasters: Raster[], maxWDxa: number, maxHDxa: number): Raster[] {
  if (rasters.length === 0) return [];
  const maxW = dxaToPx(maxWDxa);
  const maxH = dxaToPx(maxHDxa);
  const gap = 8;
  const sized = rasters.map((img) => {
    const scale = Math.min(1, maxW / img.width);
    return {
      data: img.data,
      width: Math.max(1, Math.round(img.width * scale)),
      height: Math.max(1, Math.round(img.height * scale)),
    };
  });
  const totalH = sized.reduce((sum, img) => sum + img.height, 0) + gap * Math.max(0, sized.length - 1);
  if (totalH <= maxH) return sized;
  const shrink = maxH / totalH;
  return sized.map((img) => ({
    data: img.data,
    width: Math.max(1, Math.round(img.width * shrink)),
    height: Math.max(1, Math.round(img.height * shrink)),
  }));
}

function dxaToPx(dxa: number) {
  return Math.max(1, Math.round((dxa * 96) / 1440));
}

async function fetchRemoteProof(id: string): Promise<Blob | undefined> {
  try {
    const res = await fetch(`/api/files/${encodeURIComponent(id)}`, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return undefined;
    const mime = res.headers.get("content-type") || "application/octet-stream";
    return new Blob([await res.arrayBuffer()], { type: mime });
  } catch {
    return undefined;
  }
}

async function proofBlobs(row: Transaction, proof: TxProof): Promise<Blob[]> {
  const fallback = row.proofDataUrl ? dataUrlToBlob(row.proofDataUrl) : undefined;
  const blobs = [await getStoredProofBlob(proof.id), await fetchRemoteProof(proof.id), peekProofBlob(proof.id), fallback];
  const seen = new Set<Blob>();
  const unique: Blob[] = [];
  for (const blob of blobs) {
    if (!blob || seen.has(blob)) continue;
    seen.add(blob);
    unique.push(blob);
  }
  return unique;
}

async function rasterizeProof(row: Transaction, proof: TxProof): Promise<Raster | null> {
  const blobs = await proofBlobs(row, proof);
  for (const blob of blobs) {
    if (!(await blobHasPdfMagic(blob))) continue;
    try {
      return await pdfFirstPage(blob);
    } catch {
      // try the next candidate
    }
  }
  for (const blob of blobs) {
    const kind = proofKind(proof.name, proof.mime || blob.type);
    if (!blob.type.startsWith("image/") && kind !== "image") continue;
    try {
      return await blobToRaster(blob);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function headerLooksLikePdf(bytes: Uint8Array) {
  let i = 0;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0d || bytes[i] === 0x0a)) {
    i += 1;
  }
  return bytes[i] === 0x25 && bytes[i + 1] === 0x50 && bytes[i + 2] === 0x44 && bytes[i + 3] === 0x46;
}

async function blobHasPdfMagic(blob: Blob) {
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  return headerLooksLikePdf(head);
}

async function blobToRaster(blob: Blob): Promise<Raster> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const maxEdge = 1600;
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return { data: await canvasToPng(canvas), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = url;
  });
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return new Promise<Uint8Array>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("png"));
        return;
      }
      void blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
    }, "image/png");
  });
}

let pdfjsLoader: Promise<typeof import("pdfjs-dist")> | null = null;

async function loadPdfjs() {
  if (!pdfjsLoader) {
    pdfjsLoader = import("pdfjs-dist/webpack.mjs") as Promise<typeof import("pdfjs-dist")>;
  }
  return pdfjsLoader;
}

async function pdfFirstPage(blob: Blob): Promise<Raster> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({
    data,
    verbosity: 0,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
  }).promise;
  try {
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 1600 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, background: "#ffffff" }).promise;
    return { data: await canvasToPng(canvas), width: canvas.width, height: canvas.height };
  } finally {
    await doc.destroy();
  }
}
