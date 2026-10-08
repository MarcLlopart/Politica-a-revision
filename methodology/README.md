# Assessment method (rubric v1)

Status: **proposed**. Not yet frozen; no assessment has been made with it.
The machine-readable version is [`rubric.v1.json`](./rubric.v1.json). If this file and the JSON ever disagree, the JSON is authoritative.

## Why this exists before any assessment

The rubric is written and frozen before it is applied to any party, then applied to all parties in one batch. Thresholds are not tuned after seeing results. A change to the rubric creates a new version (`rubric.v2.json`) that is re-applied to every party at once. Each assessment records the rubric version it used, and the build fails if published assessments use different versions.

## What gets assessed

Only proposals of type `fiscal_cost`, `revenue` or `quantified_target`. Proposals of type `regulatory` or `non_measurable` are listed with the band **Not assessable** and never scored.

Each assessment card has:

1. **Plain restatement**, numbers only. Example: "Build 200,000 public homes over 4 years = 50,000 a year."
2. **Baseline**: the latest complete-year value of the mapped indicator and its trend since 2018, with source.
3. **Required change**: absolute and percentage change per year, or the yearly cost in euros and as % of GDP.
4. **Historical benchmark**: the largest comparable change in Spain since 2000, and in any EU-27 member state where a comparable series exists.
5. **Funding identified**: `yes` / `partial` / `no` / `na`, based only on the programme text.
6. **Independent estimates** (AIReF, Banco de España, Fedea, OECD, academic work), or an explicit "none found".
7. **Result band** (icon + label, never colour alone).
8. **Calculation**: formula, inputs with source ids, result. Stored so it can be re-run from the repository.
9. **Confidence**: `high` / `medium` / `low`; `low` must be explained.

## Bands

| Band | Rule |
|---|---|
| Consistent with recent data | required change ≤ Spain's largest change in the same direction over a window of the same length starting 2000 or later |
| Ambitious | larger than Spain's best, but ≤ the largest observed in any current EU-27 member state |
| Beyond any observed precedent | larger than both |
| Not assessable | regulatory or non-measurable proposals; no score |

**Cost not covered** is a separate flag, shown alongside the band: a `fiscal_cost` or `revenue` proposal whose net yearly budget cost (spending increase or revenue reduction) exceeds **0.5% of nominal GDP** (latest complete year) and whose funding is `no`.

There is no overall party score.

## Definitions the brief left open (decisions to confirm before freezing)

These were needed to make the rubric computable. They should be confirmed by the owner before the rubric is frozen:

- **Window length.** The brief says "4-year change". Proposals with another horizon are compared with windows of their own length (1–8 years); proposals with no horizon use 4 years (one legislature).
- **Change metric.** Rates and shares (%, % of GDP) use percentage-point changes; levels (persons, euros, dwellings…) use relative % changes.
- **Direction.** A required increase is compared with the largest observed increase, a required decrease with the largest observed decrease.
- **Missing EU-27 series.** If no comparable EU-27 series exists, anything beyond Spain's benchmark is "Ambitious" (with a note), never "Beyond any observed precedent".
- **Series breaks.** Benchmark windows that cross a documented series break (e.g. EM → EMCR migration statistics in 2021) are excluded.
- **Partial funding** does not trigger "Cost not covered"; only `no` does.

## Who is affected (amount thresholds)

When a proposal targets a group defined by an amount ("rentas de más de 100.000 €", "pensiones por debajo de 1.000 €", "patrimonios de más de 3 millones"), the card states the share and number of people above that amount in the matching distribution (taxable income → IRPF returns; wages → wage earners; pensions → retirement pensions or pensioners; wealth → wealth-tax filers or household wealth), for the latest period. The estimate uses the same method as the distribution cards (`lib/distribution.ts`, `shareAbove`). If no distribution matches, the card says so.

## Blind assessment

Before a proposal reaches an assessor (person or model), `partyId` and `edition` are removed, and party names, acronyms, list or coalition names, leader names and logos are replaced with `[PARTY]`. The party is re-attached only after the assessment is saved. All parties are assessed in one batch, in a random order whose seed is recorded.

## Language

User-facing text uses the band labels and measured statements only. No adjectives about parties or proposals ("absurd", "brave", "populist"…), and never the word "hallucination". `tests/neutrality.test.ts` scans messages and content for banned terms.

## Freezing

To freeze: set `"status": "frozen"` and `"frozenAt": "<YYYY-MM-DD>"` in `rubric.v1.json` in a commit that changes nothing else. The assessment pipeline refuses to run with a rubric that is not frozen.
