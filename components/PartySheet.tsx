"use client";

import { useRef, type ReactNode } from "react";

/** Mobile bottom sheet holding the party menu. Uses the native <dialog> for focus handling. */
export function PartySheet({ openLabel, closeLabel, title, children }: { openLabel: string; closeLabel: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <div className="sm:hidden">
      <button type="button" className="card w-full text-left text-sm font-semibold" onClick={() => ref.current?.showModal()}>
        {openLabel}
      </button>
      <dialog
        ref={ref}
        aria-label={title}
        className="party-sheet m-0 mt-auto max-h-[80dvh] w-full max-w-none rounded-t-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--ink)] backdrop:bg-black/40"
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2>{title}</h2>
          <button type="button" className="icon-button rounded px-3 py-2 text-sm" onClick={() => ref.current?.close()}>
            {closeLabel}
          </button>
        </div>
        <div onClick={(e) => (e.target as HTMLElement).closest("a") && ref.current?.close()}>{children}</div>
      </dialog>
    </div>
  );
}
