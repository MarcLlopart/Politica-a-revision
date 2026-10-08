"use client";

// Pay-as-you-go balance identity: contributions collected = pensions paid
//   rate × contributors × average wage = pensions × average pension
//   ⇒ rate = (average pension / average wage) / (contributors / pensions)
// Averages, not medians: the identity compares totals.

import { useId, useState } from "react";

type Labels = {
  title: string;
  ratioLabel: string;
  replacementLabel: string;
  resultLabel: string;
  actualLabel: string;
  reset: string;
  formula: string;
};

type Props = {
  intlLocale: string;
  /** Today's values, from the indicators shown on the page. */
  contributorsPerPension: number;
  pensionToWage: number;
  /** Contribution rate that finances pensions today (common contingencies), percent. */
  actualRate: number;
  labels: Labels;
};

export function BalanceCalculator({ intlLocale, contributorsPerPension, pensionToWage, actualRate, labels }: Props) {
  const [ratio, setRatio] = useState(contributorsPerPension);
  const [replacement, setReplacement] = useState(pensionToWage);
  const ratioId = useId();
  const replId = useId();
  const required = (replacement / ratio) * 100;
  const pct = new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 });
  const num = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  const scaleMax = 60;
  const pos = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`;

  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-3 text-sm">
      <p className="font-semibold">{labels.title}</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={ratioId} className="block text-xs font-semibold text-[var(--ink-2)]">
            {labels.ratioLabel}: <span className="tabular-nums text-[var(--ink)]">{num.format(ratio)}</span>
          </label>
          <input id={ratioId} type="range" min={1} max={3.5} step={0.01} value={ratio} onChange={(e) => setRatio(Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <label htmlFor={replId} className="block text-xs font-semibold text-[var(--ink-2)]">
            {labels.replacementLabel}: <span className="tabular-nums text-[var(--ink)]">{pct.format(replacement)}</span>
          </label>
          <input id={replId} type="range" min={0.3} max={1} step={0.005} value={replacement} onChange={(e) => setReplacement(Number(e.target.value))} className="w-full" />
        </div>
      </div>
      <p className="mt-3" aria-live="polite">
        {labels.resultLabel}: <strong className="text-lg">{pct.format(required / 100)}</strong>
      </p>
      {/* A simple scale: the required rate against the actual rate. */}
      <div className="relative mt-2 h-6" aria-hidden="true">
        <div className="absolute inset-x-0 top-2.5 h-1 rounded bg-[var(--border)]" />
        <div className="absolute top-1 h-4 w-1 rounded bg-[var(--series-1)]" style={{ left: pos(required) }} />
        <div className="absolute top-0 h-6 w-0.5 bg-[var(--ink-2)]" style={{ left: pos(actualRate) }} />
      </div>
      <p className="text-xs text-[var(--ink-2)]">
        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[var(--series-1)]" aria-hidden="true" />
        {labels.resultLabel} · <span className="mx-1 inline-block h-3 w-0.5 bg-[var(--ink-2)] align-middle" aria-hidden="true" />
        {labels.actualLabel}: {pct.format(actualRate / 100)}
      </p>
      <p className="mt-2 text-xs text-[var(--ink-2)]">
        <code>{labels.formula}</code>
      </p>
      <button
        type="button"
        className="mt-2 min-h-6 text-xs text-[var(--link)] underline"
        onClick={() => {
          setRatio(contributorsPerPension);
          setReplacement(pensionToWage);
        }}
      >
        {labels.reset}
      </button>
    </div>
  );
}
