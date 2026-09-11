"use client";

import { ProofThumb } from "@/components/finance/ProofPreview";
import { formatFileBytes } from "@/lib/fileLimits";
import { downloadBlob, eventAttachments } from "@/lib/proof";
import { getProofBlob } from "@/lib/proofDb";
import { cachedDbHealth, clubFileHref, clubFileSignedGet } from "@/lib/remoteClient";
import { useClub } from "@/lib/store";
import type { EventAttachment } from "@/lib/types";
import { Paperclip } from "lucide-react";
import { useRef, useState } from "react";

function triggerDownload(href: string, name: string) {
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = name || "download";
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

export function EventAttachmentList({ eventId }: { eventId: string }) {
  const { events, addEventAttachment, removeEventAttachment, toast } = useClub();
  const event = events.find((item) => item.id === eventId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  if (!event) return null;

  const items = eventAttachments(event);

  async function attach(files: File[]) {
    try {
      for (const file of files) {
        setUploading(file.name);
        setProgress(0);
        await addEventAttachment(eventId, file, (ratio) => setProgress(ratio));
      }
      toast(files.length > 1 ? `첨부파일 ${files.length}개를 추가했어요` : "첨부파일을 추가했어요");
    } catch (error: unknown) {
      toast(error instanceof Error ? error.message : "파일을 읽지 못했어요");
    } finally {
      setUploading(null);
      setProgress(0);
    }
  }

  async function download(item: EventAttachment) {
    if (cachedDbHealth()?.files) {
      try {
        const url = await clubFileSignedGet(item.id, item.name, true);
        triggerDownload(url, item.name);
        return;
      } catch {
        triggerDownload(clubFileHref(item.id, true), item.name);
        return;
      }
    }
    const blob = await getProofBlob(item.id);
    if (!blob) {
      toast("파일이 없어요. 다시 첨부해 주세요.");
      return;
    }
    downloadBlob(blob, item.name);
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        aria-label="첨부파일 추가"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void attach(files);
        }}
      />
      {items.length ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <div key={item.id} className="w-14" data-event-attach={item.id}>
              <ProofThumb proof={item} size="tile" />
              <button
                type="button"
                data-attach-download={item.id}
                className="mt-0.5 block w-full truncate text-left text-[11px] text-brand-text hover:underline"
                title={`${item.name}${item.bytes ? ` ${formatFileBytes(item.bytes)}` : ""} 내려받기`}
                onClick={() => void download(item)}
              >
                {item.name}
              </button>
              <button
                type="button"
                className="text-[11px] text-faint hover:text-up"
                onClick={() => void removeEventAttachment(eventId, item.id)}
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            data-attach-add
            disabled={Boolean(uploading)}
            className="flex h-14 w-14 flex-col items-center justify-center rounded-[4px] border border-dashed border-line text-faint hover:border-brand hover:text-brand-text disabled:opacity-50"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            <span className="mt-0.5 text-[10px]">추가</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-attach-add
          disabled={Boolean(uploading)}
          className="inline-flex min-h-touch items-center gap-1.5 text-[13px] font-medium text-brand-text hover:underline disabled:opacity-50 lg:min-h-0"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          첨부파일 추가하기
        </button>
      )}
      {uploading ? (
        <p className="mt-1.5 text-[12px] text-sub" data-attach-progress>
          {uploading} 올리는 중 {Math.round(progress * 100)}%
        </p>
      ) : null}
    </div>
  );
}

export function PendingFileList({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        aria-label="첨부파일 추가"
        onChange={(e) => {
          const next = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (next.length) onChange([...files, ...next]);
        }}
      />
      {files.length ? (
        <div className="space-y-1.5">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="flex items-center gap-2 text-[13px] text-ink">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-faint" />
              <span className="min-w-0 flex-1 truncate">
                {file.name}
                {file.size ? <span className="ml-1 text-[12px] text-faint">{formatFileBytes(file.size)}</span> : null}
              </span>
              <button
                type="button"
                className="shrink-0 text-[12px] text-faint hover:text-up"
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                삭제
              </button>
            </div>
          ))}
          <button
            type="button"
            className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-text hover:underline"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-3.5 w-3.5" />
            파일 추가
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="flex h-touch w-full items-center gap-2 rounded-btn border border-line px-3 text-compact text-sub hover:bg-muted lg:h-10 lg:text-[13px]"
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-3.5 w-3.5" />
          파일첨부
        </button>
      )}
    </div>
  );
}
