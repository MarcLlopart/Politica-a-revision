"use client";

// "Where does this amount fall?" Type an amount (e.g. the one a programme uses) and see
// the share and number of people above it. Uses the same interpolation as the server.

import { useId, useState } from "react";
import { shareAbove, type Bracket } from "@/lib/distribution";

type Props = {
  brackets: Bracket[];
  total: number;
  intlLocale: string;
  label: string;
  /** Message templates with {share}, {count} and {amount}; {lower} for the unknown case. */
  resultTemplate: string;
  unknownTemplate: string;
  initial: number;
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? "");
}

export function ThresholdChecker({ brackets, total, intlLocale, label, resultTemplate, unknownTemplate, initial }: Props) {
  const [amount, setAmount] = useState(String(initial));
  const id = useId();
  const value = Number(amount.replace(",", "."));
  const valid = amount.trim() !== "" && Number.isFinite(value) && value >= 0;
  const share = valid ? shareAbove(brackets, value) : null;
  const pct = new Intl.NumberFormat(intlLocale, { style: "percent", maximumFractionDigits: 1, useGrouping: "always" });
  const num = new Intl.NumberFormat(intlLocale, { maximumFractionDigits: 0, useGrouping: "always" });
  const eur = new Intl.NumberFormat(intlLocale, { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
  const openLower = brackets.find((b) => b.upper === null)?.lower ?? 0;

  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
      <label htmlFor={id} className="font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="mt-1 block w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 tabular-nums"
      />
      <p className="mt-2" aria-live="polite">
        {!valid
          ? ""
          : share === null
            ? fill(unknownTemplate, { lower: eur.format(openLower) })
            : fill(resultTemplate, { share: pct.format(share), count: num.format(Math.round(share * total)), amount: eur.format(value) })}
      </p>
    </div>
  );
}
