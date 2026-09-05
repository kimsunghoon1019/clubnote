import type { ClubEvent, EventAttachment, Transaction, TxProof } from "./types";

const MAX_PROOF_BYTES = 8 * 1024 * 1024;
const IMAGE_MAX_EDGE = 1280;

export type ProofKind = "image" | "pdf" | "other" | "none";

export function txProofs(row: Pick<Transaction, "id" | "proofs" | "proofName" | "proofMime">): TxProof[] {
  if (Array.isArray(row.proofs)) return row.proofs;
  if (row.proofName) {
    return [{ id: `pf-${row.id}`, name: row.proofName, mime: row.proofMime || "" }];
  }
  return [];
}

export function persistableTransaction(row: Transaction): Transaction {
  const { proofName: _name, proofMime: _mime, proofDataUrl: _data, ...rest } = row;
  return { ...rest, proofs: txProofs(row) };
}

export function eventAttachments(event: Pick<ClubEvent, "id" | "attachments" | "attachmentName">): EventAttachment[] {
  if (Array.isArray(event.attachments)) return event.attachments;
  if (event.attachmentName) {
    return [{ id: `att-${event.id}`, name: event.attachmentName, mime: "" }];
  }
  return [];
}

export function persistableEvent(event: ClubEvent): ClubEvent {
  const { attachmentName: _legacy, ...rest } = event;
  return { ...rest, attachments: eventAttachments(event) };
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name || "download";
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function proofKind(name?: string, mime?: string): ProofKind {
  if (!name && !mime) return "none";
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  return "other";
}

export function isImageBlob(blob?: Blob, mime?: string) {
  if (blob?.type.startsWith("image/")) return true;
  return (mime ?? "").startsWith("image/");
}

export async function fileToProof(file: File): Promise<{ meta: TxProof; blob: Blob }> {
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error("파일은 8MB 이하만 올릴 수 있어요");
  }
  const mime = file.type || guessMime(file.name);
  const kind = proofKind(file.name, mime);
  const blob = kind === "image" ? await compressImage(file) : file.slice(0, file.size, mime);
  return {
    meta: {
      id: newProofId(),
      name: file.name,
      mime: blob.type || mime,
    },
    blob,
  };
}

export function dataUrlToBlob(dataUrl: string, mime?: string): Blob {
  const comma = dataUrl.indexOf(",");
  const head = comma >= 0 ? dataUrl.slice(0, comma) : "";
  const body = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = /;base64/i.test(head) ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const type = mime || head.match(/data:([^;,]+)/)?.[1] || "application/octet-stream";
  return new Blob([bytes], { type });
}

export function placeholderImageDataUrl(title: string, caption: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="480" viewBox="0 0 360 480">
    <rect width="360" height="480" fill="#f2f4f6"/>
    <rect x="36" y="32" width="288" height="416" rx="6" fill="#fff" stroke="#e5e8eb"/>
    <rect x="60" y="56" width="240" height="168" rx="4" fill="#eef2f6"/>
    <text x="180" y="148" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" fill="#8b95a1">RECEIPT</text>
    <text x="180" y="268" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" fill="#191f28">${escapeXml(title)}</text>
    <text x="180" y="296" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="13" fill="#8b95a1">${escapeXml(caption)}</text>
    <rect x="60" y="336" width="240" height="8" rx="2" fill="#e5e8eb"/>
    <rect x="60" y="356" width="176" height="8" rx="2" fill="#f2f4f6"/>
    <rect x="60" y="376" width="208" height="8" rx="2" fill="#f2f4f6"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function newProofId() {
  return `pf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function guessMime(name: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function compressImage(file: File) {
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return Promise.resolve(file.slice(0, file.size, "image/svg+xml"));
  }
  return new Promise<Blob>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("이미지를 읽지 못했어요"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("이미지를 읽지 못했어요"));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        0.78,
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file.slice(0, file.size, file.type || "image/jpeg"));
    };
    image.src = objectUrl;
  });
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
