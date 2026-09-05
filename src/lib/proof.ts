export type ProofFields = {
  proofName?: string;
  proofMime?: string;
  proofDataUrl?: string;
};

export const EMPTY_PROOF: ProofFields = {
  proofName: undefined,
  proofMime: undefined,
  proofDataUrl: undefined,
};

const MAX_PROOF_BYTES = 1.5 * 1024 * 1024;
const IMAGE_MAX_EDGE = 1280;

export type ProofKind = "image" | "pdf" | "other" | "none";

export function proofKind(name?: string, mime?: string): ProofKind {
  if (!name && !mime) return "none";
  const m = (mime ?? "").toLowerCase();
  const n = (name ?? "").toLowerCase();
  if (m.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(n)) return "image";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  return "other";
}

export function isImageProofData(dataUrl?: string, mime?: string) {
  if (dataUrl?.startsWith("data:image/")) return true;
  return Boolean(dataUrl && (mime ?? "").startsWith("image/"));
}

export async function proofFromFile(file: File): Promise<Required<ProofFields>> {
  if (file.size > MAX_PROOF_BYTES) {
    throw new Error("증빙은 1.5MB 이하만 올릴 수 있어요");
  }
  const proofMime = file.type || guessMime(file.name);
  const kind = proofKind(file.name, proofMime);
  const proofDataUrl = kind === "image" ? await compressImage(file) : await readAsDataUrl(file);
  return { proofName: file.name, proofMime, proofDataUrl };
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

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("파일을 읽지 못했어요"));
    reader.readAsDataURL(file);
  });
}

function compressImage(file: File) {
  if (file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg")) {
    return readAsDataUrl(file);
  }
  return new Promise<string>((resolve, reject) => {
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
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      readAsDataUrl(file).then(resolve, reject);
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
