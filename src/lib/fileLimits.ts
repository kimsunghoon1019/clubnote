/** 캘린더 첨부·회계 증빙. R2 단일 객체 한도(5GB). 그 이상은 동아리 버킷 용량에도 안 맞음. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024 * 1024;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** 미리보기용으로 브라우저에 내리는 상한. 넘으면 아이콘만. */
export const FILE_PREVIEW_MAX_BYTES = 16 * 1024 * 1024;
/** Vercel 서버리스 본문 한도(4.5MB) 아래. 이 크기는 API 프록시 PUT. */
export const FILE_PROXY_MAX_BYTES = 4 * 1024 * 1024;
/** CORS 없이 큰 파일을 올릴 때 조각 크기. 4.5MB 한도보다 여유 있게. */
export const FILE_CHUNK_BYTES = 3.5 * 1024 * 1024;
/** R2 멀티파트 파트 최소 5MB. 청크를 이만큼 모아서 한 파트로 올린다. */
export const FILE_ASSEMBLE_PART_BYTES = 8 * 1024 * 1024;
/** 이보다 크면 멀티파트. R2 파트 최소 5MB라 파트 크기는 이 값 이상. */
export const FILE_SINGLE_PUT_MAX_BYTES = 80 * 1024 * 1024;
export const FILE_PART_SIZE = 16 * 1024 * 1024;
export const FILE_CACHE_MAX_BYTES = 8 * 1024 * 1024;

export function formatFileBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${Math.round(bytes)}B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let n = bytes / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const digits = n >= 10 ? 0 : 1;
  return `${n.toFixed(digits)}${units[i]}`;
}
