"use client";

import { cn } from "@/lib/cn";
import { isImageProofData, proofKind } from "@/lib/proof";
import { FileText, X } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ProofThumb({
  name,
  mime,
  dataUrl,
  size = "table",
}: {
  name?: string;
  mime?: string;
  dataUrl?: string;
  size?: "table" | "rail";
}) {
  const kind = proofKind(name, mime);

  if (kind === "none") {
    return <span className="text-[12px] text-faint">증빙없음</span>;
  }

  const rail = size === "rail";

  return (
    <span className={cn("inline-flex", rail && "block w-full")} onClick={(event) => event.stopPropagation()}>
      <ProofZoom name={name ?? "증빙"} mime={mime} dataUrl={dataUrl}>
        {isImageProofData(dataUrl, mime) ? (
          <span className="relative inline-flex">
            <img
              src={dataUrl}
              alt=""
              className={cn(
                "bg-muted object-cover",
                rail
                  ? "h-28 w-full rounded-btn border border-line-soft object-contain"
                  : "h-9 w-9 rounded-[4px] border border-line-soft",
              )}
            />
            {kind === "pdf" ? (
              <span
                className={cn(
                  "absolute bottom-0 left-0 right-0 bg-[#E5484D] text-center font-semibold tracking-wide text-white",
                  rail ? "rounded-b-btn py-0.5 text-[10px]" : "rounded-b-[4px] text-[7px] leading-3",
                )}
              >
                PDF
              </span>
            ) : null}
          </span>
        ) : (
          <FilePageThumb kind={kind} rail={rail} />
        )}
      </ProofZoom>
    </span>
  );
}

function FilePageThumb({ kind, rail }: { kind: "pdf" | "other" | "image" | "none"; rail: boolean }) {
  return (
    <span
      className={cn(
        "relative flex flex-col overflow-hidden border border-line-soft bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)]",
        rail ? "h-28 w-full items-center justify-center rounded-btn" : "h-9 w-7 rounded-[3px] px-[5px] pt-[5px]",
      )}
    >
      {rail ? <FileText className="h-8 w-8 text-faint" /> : (
        <>
          <span className="h-[3px] w-full rounded-sm bg-[#e5e8eb]" />
          <span className="mt-[3px] h-[3px] w-[70%] rounded-sm bg-[#f2f4f6]" />
          <span className="mt-[3px] h-[3px] w-[85%] rounded-sm bg-[#f2f4f6]" />
        </>
      )}
      {kind === "pdf" ? (
        <span
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-[#E5484D] text-center font-semibold tracking-wide text-white",
            rail ? "py-0.5 text-[10px]" : "text-[7px] leading-3",
          )}
        >
          PDF
        </span>
      ) : null}
    </span>
  );
}

function ProofZoom({
  name,
  mime,
  dataUrl,
  children,
}: {
  name: string;
  mime?: string;
  dataUrl?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <span className="relative inline-flex w-full">
        {children}
        <button
          type="button"
          className="absolute inset-0 cursor-zoom-in rounded-[4px]"
          aria-label={`${name} 증빙 보기`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        />
      </span>
      {open ? <ProofLightbox name={name} mime={mime} dataUrl={dataUrl} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PdfFrame({ name, dataUrl }: { name: string; dataUrl: string }) {
  const [src, setSrc] = useState(dataUrl);

  useEffect(() => {
    if (!dataUrl.startsWith("data:")) {
      setSrc(dataUrl);
      return;
    }
    let blobUrl = "";
    let cancelled = false;
    void fetch(dataUrl)
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(dataUrl);
      });
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [dataUrl]);

  return (
    <iframe
      title={name}
      src={src}
      className="h-[min(82vh,900px)] w-[min(92vw,760px)] rounded-md bg-white shadow-lg"
    />
  );
}

function ProofLightbox({
  name,
  mime,
  dataUrl,
  onClose,
}: {
  name: string;
  mime?: string;
  dataUrl?: string;
  onClose: () => void;
}) {
  const kind = proofKind(name, mime);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stop = (event: MouseEvent) => event.stopPropagation();

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-6"
      role="dialog"
      aria-modal
      aria-label={name}
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-5 top-5 rounded-btn p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
        aria-label="닫기"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={stop}>
        {isImageProofData(dataUrl, mime) ? (
          <img src={dataUrl} alt={name} className="max-h-[80vh] max-w-[90vw] rounded-md object-contain shadow-lg" />
        ) : kind === "pdf" && dataUrl ? (
          <PdfFrame name={name} dataUrl={dataUrl} />
        ) : (
          <div className="flex min-w-[280px] flex-col items-center gap-3 rounded-card bg-white px-10 py-12">
            <FileText className="h-10 w-10 text-faint" />
            <p className="text-[15px] font-medium">{name}</p>
            {dataUrl ? (
              <a href={dataUrl} download={name} className="text-[13px] text-brand-text">
                내려받기
              </a>
            ) : (
              <p className="text-[12px] text-faint">미리볼 파일이 없어요. 다시 첨부해 주세요.</p>
            )}
          </div>
        )}
        <p className="max-w-[80vw] truncate text-[12px] text-white/80">{name}</p>
      </div>
    </div>,
    document.body,
  );
}
