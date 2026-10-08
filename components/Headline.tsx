import type { Formatters } from "@/lib/i18n-server";
import type { Indicator } from "@/lib/schema";

/** Large headline number with its unit wording set smaller, e.g. "37.3%" + "of GDP". */
export function Headline({ ind, value, f, size = "lg" }: { ind: Indicator; value: number; f: Formatters; size?: "lg" | "md" }) {
  const { number, suffix } = f.indicatorParts(ind, value);
  return (
    <span className="whitespace-nowrap font-semibold">
      <span className={size === "lg" ? "text-3xl" : "text-xl"}>{number}</span>
      {suffix && <span className="ml-1 text-sm font-normal text-[var(--ink-2)]">{suffix}</span>}
    </span>
  );
}
