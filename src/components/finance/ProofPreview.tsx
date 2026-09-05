"use client";

import { cn } from "@/lib/cn";
import { isImageBlob, proofKind } from "@/lib/proof";
import { getProofBlob, peekProofBlob, subscribeProofStore } from "@/lib/proofDb";
import type { TxProof } from "@/lib/types";
import { FileText, X } from "lucide-react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ProofThumbs({ proofs, size = "table" }: { proofs: TxProof[]; size?: "table" | "rail" }) {
  if (!proofs.length) return <span className="text-[12px] text-faint">증빙없음</span>;
  return (
    <span className={cn("inline-flex items-center", size === "table" ? "gap-1" : "w-full flex-col gap-2")}>
      {proofs.map((proof) => (
        <ProofThumb key={proof.id} proof={proof} size={size} />
      ))}
    </span>
  );
}

export function ProofThumb({ proof, size = "table" }: { proof: TxProof; size?: "table" | "rail" }) {
  const { url, blob } = useProofBlob(proof.id);
  const kind = proofKind(proof.name, proof.mime);
  const image = isImageBlob(blob, blob?.type || proof.mime);
  const rail = size === "rail";

  return (
    <span className={cn("inline-flex", rail && "block w-full")} onClick={(event) => event.stopPropagation()}>
      <ProofZoom proof={proof} url={url} blob={blob}>
        {image && url ? (
          <span className="relative inline-flex w-full">
            <img
              src={url}
              alt=""
              className={cn(
                "bg-muted object-cover",
                rail
                  ? "h-28 w-full rounded-btn border border-line-soft object-contain"
                  : "h-9 w-9 rounded-[4px] border border-line-soft",
              )}
            />
            {kind === "pdf" ? <PdfBadge rail={rail} /> : null}
          </span>
        ) : kind === "pdf" && url ? (
          <span
            className={cn(
              "relative overflow-hidden border border-line-soft bg-white",
              rail ? "block h-28 w-full rounded-btn" : "inline-flex h-9 w-7 rounded-[3px]",
            )}
          >
            <iframe title={proof.name} src={url} className="pointer-events-none h-[140%] w-full border-0 bg-white" />
            <PdfBadge rail={rail} />
          </span>
        ) : (
          <FilePageThumb kind={kind} rail={rail} />
        )}
      </ProofZoom>
    </span>
  );
}

function PdfBadge({ rail }: { rail: boolean }) {
  return (
    <span
      className={cn(
        "absolute bottom-0 left-0 right-0 bg-[#E5484D] text-center font-semibold tracking-wide text-white",
        rail ? "rounded-b-btn py-0.5 text-[10px]" : "rounded-b-[3px] text-[7px] leading-3",
      )}
    >
      PDF
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
      {rail ? (
        <FileText className="h-8 w-8 text-faint" />
      ) : (
        <>
          <span className="h-[3px] w-full rounded-sm bg-[#e5e8eb]" />
          <span className="mt-[3px] h-[3px] w-[70%] rounded-sm bg-[#f2f4f6]" />
          <span className="mt-[3px] h-[3px] w-[85%] rounded-sm bg-[#f2f4f6]" />
        </>
      )}
      {kind === "pdf" ? <PdfBadge rail={rail} /> : null}
    </span>
  );
}

function ProofZoom({
  proof,
  url,
  blob,
  children,
}: {
  proof: TxProof;
  url: string;
  blob?: Blob;
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
          aria-label={`${proof.name} 증빙 보기`}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        />
      </span>
      {open ? <ProofLightbox proof={proof} url={url} blob={blob} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ProofLightbox({
  proof,
  url,
  blob,
  onClose,
}: {
  proof: TxProof;
  url: string;
  blob?: Blob;
  onClose: () => void;
}) {
  const kind = proofKind(proof.name, proof.mime);
  const image = isImageBlob(blob, blob?.type || proof.mime);

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
      aria-label={proof.name}
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
        {image && url ? (
          <img src={url} alt={proof.name} className="max-h-[80vh] max-w-[90vw] rounded-md object-contain shadow-lg" />
        ) : kind === "pdf" && url ? (
          <iframe
            title={proof.name}
            src={url}
            className="h-[min(82vh,900px)] w-[min(92vw,760px)] rounded-md bg-white shadow-lg"
          />
        ) : url ? (
          <div className="flex min-w-[280px] flex-col items-center gap-3 rounded-card bg-white px-10 py-12">
            <FileText className="h-10 w-10 text-faint" />
            <p className="text-[15px] font-medium">{proof.name}</p>
            <a href={url} download={proof.name} className="text-[13px] text-brand-text">
              내려받기
            </a>
          </div>
        ) : (
          <div className="flex min-w-[280px] flex-col items-center gap-3 rounded-card bg-white px-10 py-12">
            <FileText className="h-10 w-10 text-faint" />
            <p className="text-[15px] font-medium">{proof.name}</p>
            <p className="text-[12px] text-faint">미리볼 파일이 없어요. 다시 첨부해 주세요.</p>
          </div>
        )}
        <p className="max-w-[80vw] truncate text-[12px] text-white/80">{proof.name}</p>
      </div>
    </div>,
    document.body,
  );
}

function useProofBlob(id: string) {
  const [blob, setBlob] = useState<Blob | undefined>(() => peekProofBlob(id));

  useEffect(() => {
    let alive = true;
    const load = () => {
      void getProofBlob(id).then((next) => {
        if (alive) setBlob(next);
      });
    };
    load();
    return subscribeProofStore(load);
  }, [id]);

  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);

  return { blob, url };
}
