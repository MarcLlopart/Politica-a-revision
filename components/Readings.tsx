import type { Formatters } from "@/lib/i18n-server";
import type { Reading, Tally, Tone } from "@/lib/readings";
import type { Indicator } from "@/lib/schema";

// Status colours carry the reading; the icon shape (tick, warning triangle, equals sign) and a
// screen-reader label carry it too, so it never depends on colour alone. Unrated changes get a
// grey arrow: they show the direction only.
const ICON_COLOR: Record<Tone, string> = { favourable: "var(--good)", unfavourable: "var(--bad)", neutral: "var(--ink-2)" };
const FIGURE_COLOR: Record<Tone, string> = { favourable: "var(--good-ink)", unfavourable: "var(--bad-ink)", neutral: "var(--ink-2)" };

type Mark = Tone | "up" | "down";

export function ToneIcon({ mark }: { mark: Mark }) {
  const color = mark === "up" || mark === "down" ? "var(--ink-2)" : ICON_COLOR[mark];
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" className="inline-block shrink-0" aria-hidden="true" focusable="false">
      {mark === "favourable" && (
        <>
          <circle cx="8" cy="8" r="7.5" fill={color} />
          <path d="M4.5 8.3 7 10.7l4.6-5.2" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {mark === "unfavourable" && (
        <>
          <path d="M8 .8 15.4 14.6H.6Z" fill={color} strokeLinejoin="round" />
          <path d="M8 5.6v4.2" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8" cy="12.2" r="1" fill="#fff" />
        </>
      )}
      {mark === "neutral" && (
        <>
          <circle cx="8" cy="8" r="6.8" fill="none" stroke={color} strokeWidth="1.4" />
          <path d="M5.2 6.6h5.6M5.2 9.4h5.6" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </>
      )}
      {(mark === "up" || mark === "down") && (
        <path
          d={mark === "up" ? "M8 2.5v11M3.8 6.7 8 2.5l4.2 4.2" : "M8 13.5v-11M3.8 9.3 8 13.5l4.2-4.2"}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Icon for a reading: its tone if rated, else the direction of the change. */
function markOf(r: Reading): Mark {
  if (r.rated || r.kind !== "change" || r.flat) return r.tone;
  return r.change > 0 ? "up" : "down";
}

/** Signed percentage points, e.g. "+9.0 pp". */
function pp(f: Formatters, v: number, signed = true): string {
  return f.t("readings.pp", { value: f.number(v, "ratio", { decimals: 1, signed }) });
}

const pct = (f: Formatters, v: number) => f.number(v, "percent_change", { decimals: 1 });

function figureAndText(r: Reading, ind: Indicator, f: Formatters): [string, string] {
  const { t } = f;
  const per = (p: string) => f.periodOf(ind, p);
  switch (r.kind) {
    case "vsCpiRate": {
      const dir = r.tone === "neutral" ? "inLine" : r.diff > 0 ? "above" : "below";
      // Above/below say the direction, so the gap is unsigned; "in line" keeps the sign.
      const gap = dir === "inLine" ? pp(f, r.diff) : pp(f, Math.abs(r.diff), false);
      return [gap, t(`readings.rate.${dir}`, { value: pct(f, r.value), cpi: pct(f, r.cpi), period: per(r.period) })];
    }
    case "vsCpiLevel": {
      const text = t("readings.level", { from: per(r.from), to: per(r.to), nominal: pct(f, r.nominal), cpi: pct(f, r.cpi) });
      return [pct(f, r.real), r.cpiTo ? `${text} ${t("readings.cpiTo", { month: f.period(r.cpiTo) })}` : text];
    }
    case "sign":
      return [pct(f, r.value), t(`readings.sign.${r.value < 0 ? "down" : "up"}`, { period: per(r.period) })];
    case "change": {
      const figure =
        r.mode === "pp"
          ? pp(f, r.change)
          : r.mode === "pct"
            ? pct(f, r.change)
            : f.value(r.change, ind.unit, { decimals: ind.decimals, signed: true });
      return [figure, t("readings.change", { from: per(r.from) })];
    }
    case "reference": {
      return [pp(f, Math.abs(r.diff), false), t(`readings.ref.${r.ref}.${r.position}`, { period: per(r.period) })];
    }
  }
}

/** One line per reading: icon, the key figure in the reading's colour, then what it compares. */
export function Readings({ items, f }: { items: { ind: Indicator; reading: Reading; series?: string }[]; f: Formatters }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm" aria-label={f.t("readings.label")}>
      {items.map(({ ind, reading, series }, i) => {
        const [figure, text] = figureAndText(reading, ind, f);
        return (
          <li key={i} className="flex gap-2">
            <span className="mt-0.5">
              <ToneIcon mark={markOf(reading)} />
            </span>
            <span>
              <span className="sr-only">{f.t(reading.rated ? `readings.tone.${reading.tone}` : "readings.unrated")}: </span>
              {series && <span className="text-[var(--ink-2)]">{series}: </span>}
              <strong className="whitespace-nowrap font-semibold" style={{ color: FIGURE_COLOR[reading.tone] }}>
                {figure}
              </strong>{" "}
              {text}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

const TONES = ["favourable", "unfavourable", "neutral"] as const;

/** Count of a topic's marks, e.g. "Marks on this topic: ✓ 4 · ⚠ 1". */
export function TallyLine({ tally, f }: { tally: Tally; f: Formatters }) {
  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-2)]">
      <span>{f.t("readings.tally.label")}</span>
      {TONES.filter((tone) => tally[tone] > 0).map((tone) => (
        <span key={tone} className="inline-flex items-center gap-1">
          <ToneIcon mark={tone} />
          {f.t(`readings.tally.${tone}`, { count: tally[tone] })}
        </span>
      ))}
    </p>
  );
}

/**
 * Top edge of a home card split in the proportions of the topic's marks (green, grey, red).
 * Decorative: the tally line next to it states the counts.
 */
export function tallyStrip(tally: Tally): React.CSSProperties | undefined {
  const total = tally.favourable + tally.neutral + tally.unfavourable;
  if (total === 0) return undefined;
  const a = (tally.favourable / total) * 100;
  const b = a + (tally.neutral / total) * 100;
  return {
    backgroundImage: `linear-gradient(to right, var(--good) 0 ${a}%, var(--axis) ${a}% ${b}%, var(--bad) ${b}% 100%)`,
    backgroundSize: "100% 4px",
    backgroundRepeat: "no-repeat",
  };
}

/** Key to the reading icons, shown once per page that has readings. */
export function ReadingsKey({ f, methodHref }: { f: Formatters; methodHref: string }) {
  return (
    <p className="mt-3 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-2)]">
      {TONES.map((tone) => (
        <span key={tone} className="inline-flex items-center gap-1">
          <ToneIcon mark={tone} />
          {f.t(`readings.tone.${tone}`)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <ToneIcon mark="up" />
        <ToneIcon mark="down" />
        {f.t("readings.unrated")}
      </span>
      <span>
        {f.t("readings.key")} <a href={methodHref}>{f.t("readings.rulesLink")}</a>
      </span>
    </p>
  );
}
