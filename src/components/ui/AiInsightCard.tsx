export function AiInsightCard({
  title = "클럽노트 AI",
  text,
  onClick,
}: {
  title?: string;
  text: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-card border border-line-soft px-3.5 py-3 text-left hover:bg-muted"
    >
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
        <SparkleIcon />
        {title}
      </div>
      <p className="mt-1.5 text-[13px] leading-5 text-sub">{text}</p>
    </button>
  );
}

export function SparkleIcon({ className = "h-3.5 w-3.5 text-brand" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden>
      <path
        d="M8 1.5l.7 4.1L12.8 6 8.7 8.2 8 12.5l-.7-4.3L3.2 6l4.1-.4L8 1.5z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M12.5 10.2l.35 1.6 1.65.35-1.65.4-.35 1.55-.4-1.55-1.6-.4 1.6-.35.4-1.6z" fill="currentColor" />
    </svg>
  );
}
