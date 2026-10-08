import { LocaleLink as Link } from "@/components/LocaleLink";
import { Headline } from "@/components/Headline";
import { Readings, TallyLine, tallyStrip, ToneIcon } from "@/components/Readings";
import { renderSparkline } from "@/lib/chart";
import { HOME_OUTLOOK, type CardDef } from "@/lib/dashboard";
import { getIndicator, getPyramid } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";
import { comparisonStart, latest, windowed } from "@/lib/indicators";
import type { Locale } from "@/lib/locales";
import { readingsFor, topicTally } from "@/lib/readings";
import type { Topic } from "@/lib/topics";

/**
 * Home-page card: one headline number, one sparkline, one sentence, the headline's change, and
 * a count of every mark on the topic page (also drawn as the card's top edge).
 */
export function TopicCard({ topic, card, locale, f }: { topic: Topic; card: CardDef; locale: Locale; f: Formatters }) {
  const ind = getIndicator(card.indicators[0]);
  const subtitle = card.indicators.length > 1 ? f.t(`cards.${card.id}`) : ind.label[locale];
  const last = latest(ind);
  const start = comparisonStart(ind);
  const tally = topicTally(topic);
  const marks = tally.favourable + tally.unfavourable + tally.neutral;
  return (
    <Link href={`/spain/${topic}`} className="card group" style={tallyStrip(tally)}>
      <h2 className="text-base font-semibold text-[var(--ink)] group-hover:underline">{f.t(`topics.${topic}`)}</h2>
      <p className="text-xs text-[var(--ink-2)]">{subtitle}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p>
            <Headline ind={ind} value={last.value} f={f} />
          </p>
          <p className="text-xs text-[var(--ink-2)]">
            {f.periodOf(ind, last.period)}
            {last.status === "provisional" && ` · ${f.t("indicator.provisional")}`}
          </p>
        </div>
        <div className="sparkline shrink-0" dangerouslySetInnerHTML={{ __html: renderSparkline(windowed(ind)) }} />
      </div>
      <p className="mt-2 text-sm text-[var(--ink)]">
        {f.t(start.period === last.period ? "indicator.singlePoint" : "indicator.summary", {
          start: f.indicator(ind, start.value),
          startPeriod: f.periodOf(ind, start.period),
          end: f.indicator(ind, last.value),
          endPeriod: f.periodOf(ind, last.period),
        })}
      </p>
      <Readings f={f} items={readingsFor(ind, true).map((reading) => ({ ind, reading }))} />
      {HOME_OUTLOOK[topic] && <Outlook id={HOME_OUTLOOK[topic]} topic={topic} f={f} />}
      {marks > 0 && <TallyLine tally={tally} f={f} />}
    </Link>
  );
}

/** An official projection from today to 20 years ahead (unrated: a projection, not a change). */
function Outlook({ id, topic, f }: { id: string; topic: Topic; f: Formatters }) {
  const ind = getIndicator(id);
  const years = getPyramid("population-projection").years;
  const at = (p: string) => ind.observations.find((o) => o.period === p);
  const [from, to] = [at(years[0].period), at(years.at(-1)!.period)];
  if (!from || !to) return null;
  return (
    <p className="mt-1 flex gap-2 text-sm">
      <span className="mt-0.5">
        <ToneIcon mark={to.value < from.value ? "down" : "up"} />
      </span>
      <span>
        <span className="sr-only">{f.t("readings.unrated")}: </span>
        {f.t(`home.outlook.${topic}`, {
          from: f.indicator(ind, from.value),
          fromYear: from.period,
          to: f.indicator(ind, to.value),
          toYear: to.period,
        })}
      </span>
    </p>
  );
}
