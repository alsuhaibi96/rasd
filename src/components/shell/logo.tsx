export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-12 place-items-center rounded-2xl border border-brand/30 bg-brand/10 shadow-[0_0_30px_-8px] shadow-brand/60">
        <svg viewBox="0 0 24 24" className="size-7 text-brand" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12h4l2.5-6 4 13 3-9 1.5 2H22" />
        </svg>
      </span>
      <div>
        <div className="text-3xl leading-none font-bold">رَصد</div>
        <div className="mt-1 text-[10px] font-semibold tracking-[0.45em] text-muted">RASD</div>
      </div>
    </div>
  );
}
