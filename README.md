# Política a revisión

How Spain has changed since 2018 in official data, and party proposals put into numbers. Every figure is traceable to the file it was downloaded from.

Site: https://politica-a-revision.vercel.app (Vercel).

- **Spain at a glance**: 13 topics (economy, cost of living, public finances, public spending, housing, pensions, labour, income and wealth, demographics, births and deaths, immigration, emigration, safety), about 220 indicators on topic pages, from INE, Eurostat, Banco de España, AEAT, Seguridad Social, the Ministerio del Interior and other ministries, 2018 to the latest figure.
- **Green and red marks**: each card says how the latest change compares with a fixed reference: prices and incomes against the CPI, real GDP growth by its sign, other indicators against a year earlier and 2018, inflation against the ECB's 2% target, deficit and debt against the EU's 3% and 60%. One rule per indicator, the same for every period, listed on the methodology page (`lib/readings.ts`). Indicators with no direction that is good for everyone (spending, population, migration, the unadjusted pay gap…) show a grey arrow only. Home cards count every mark on their topic and split their top edge green, grey and red in the same proportions.
- **Cost of living**: how much prices have risen since 2018 by type of spending and for everyday items (eggs, milk, bread, oils, electricity, fuels, rent), prices against wages and incomes, energy prices against inflation, and how households cope (making ends meet, unexpected expenses, heating, arrears, housing costs).
- **Public spending**: where each €100 goes by function (COFOG), how it is financed, and official forecasts and long-term projections.
- **Pensions explained**: who pays and who receives today and in 4, 10 and 20 years (a slider over the EU 2024 Ageing Report's contributors, pensioners, spending and contributions, and INE's population pyramid), pension types, a balance calculator, 2026 contribution rates and legal amounts, and figures from Fedea, Banco de España, OECD and the Fondo de Reserva report, each with its archived document.
- **Gender pay gap, like for like**: Eurostat's gap after accounting for occupation, sector, employer, contract, hours, experience and education; women's full-time hourly pay as a share of men's in the same occupation group; and, last and labelled as such, the unadjusted gap.
- **Safety**: offences known to the police per inhabitant (total, excluding online fraud, homicides, violent robbery, burglary, sexual offences, online fraud) and the share of people reporting crime in their area.
- **Who is who**: average, median, most common amount, P90 and P99 for tax returns, wage earners, employees, household income, pensions and wealth, with the share of people above any amount (to place thresholds such as "rentas de más de 100.000 €"). Published percentiles are used as published; bracket-based ones are estimated with the method in `lib/distribution.ts` and marked ≈.
- **Parties**: every party with at least one seat in the Congreso after the general election of 23 July 2023, ordered by seats then alphabetically.
- **Assessments**: one frozen rubric ([`methodology/`](methodology/README.md)) applied to all parties in the same batch.
- **Languages**: Spanish (source), English and Catalan. Galician and Basque are planned. Spanish and Catalan write thousands of millions as "mM" (725 mM €); English uses "bn".

## Principles

Neutral and auditable by construction: one rubric for everyone, written before any assessment; blind assessment; no causal claims about governments; neutral wording (checked by `tests/neutrality.test.ts`); party colours only on the party chip; a public corrections log. See the [methodology page](app/[locale]/methodology/page.tsx) and [`methodology/README.md`](methodology/README.md).

## Run it

```bash
npm ci
npm run dev          # http://localhost:3000 → redirects to /es
npm test             # unit tests, brief sanity values, data validation, neutral-language scan
npm run build        # validates data, then builds static pages
```

Node 22.12 or later.

## Data pipeline

```
pipeline/
  config/       one definition per indicator, distribution or population pyramid: source, unit, labels (es/en/ca), method
  lib/          source adapters (INE Tempus3 series and tables, Eurostat, Banco de España, spreadsheets, PC-Axis, BOE, IMF, AMECO), parsers
  fetch/        downloads every source into data/raw/{group}/{date}/ with a SHA-256 manifest
  transform/    reads only data/raw and writes data/indicators/, data/distributions/, data/pyramids/ and data/sources.json
  assess/       applies the frozen rubric to reviewed proposals (milestone M3; refuses to run unfrozen)
```

```bash
npm run pipeline            # fetch + transform
npm run pipeline:fetch -- --only ine/EPA423474
PIPELINE_DATE=2026-10-08 npm run pipeline:transform
```

Transform is deterministic: the same raw files always give the same indicator files. Every observation carries a `sourceId`; each source records the publisher, table/series, download URL, retrieval date, raw-file path and hash. `npm run validate` (run before every build) fails if any value lacks a source, a raw file does not match its hash, or a translation is missing.

A weekly GitHub Action (`.github/workflows/data-refresh.yml`) re-runs the pipeline and opens a pull request with the diff. Nothing merges automatically; Vercel deploys on merge to `main`.

### Tracing a number

Card → "raw file" link → `data/raw/{group}/{date}/{file}` at the deployed commit, whose hash is in the same folder's `manifest.json` and in `data/sources.json`. The `/sources` page lists them all; each indicator's CSV has the source, URL, retrieval date and hash on every row.

### Adding an indicator

1. Find and verify the series ID against the live API (never from memory).
2. Add a definition in `pipeline/config/*.ts` (labels in es/en/ca, unit, method).
3. `npm run pipeline:fetch -- --only <key> && npm run pipeline:transform`.
4. Add it to a topic in `lib/dashboard.ts` if it should be shown.
5. If it should get a green or red mark, add one rule in `lib/readings.ts` (and it appears on the methodology page). Without a rule it shows a grey arrow.

### Downloads and certificates

The downloader (`pipeline/lib/raw.ts`) trusts Node's bundled root certificates plus the intermediates in `pipeline/certs/` (some servers, e.g. www.airef.es, do not send their full chain). Downloads therefore behave the same on any machine and in CI, whatever the local certificate store.

www.interior.gob.es blocks automated downloads (Cloudflare challenge). Crime figures come from the ministry's statistics portal (estadisticasdecriminalidad.ses.mir.es), which serves the same tables as PC-Axis files.

### Forecasts and figures from documents

- **Forecasts and projections** come only from their publishers (IMF WEO, European Commission AMECO, EU Ageing Report 2024, AIReF, INE projections); the site makes none of its own. Each series keeps its last actual year as an anchor and marks later years `forecast`; charts draw them dashed. Vintages are set in `pipeline/config/forecasts.ts`, so a new release is a reviewed change.
- **Figures that only exist in documents** (laws, reports, studies) live in `data/estimates/*.json` with the exact page or article. `npm run documents:archive` stores each document under `sources/documents/` with its SHA-256; validation fails if a document is missing or changed, and `tests/estimates.test.ts` re-reads the machine-readable ones. They show "pending a second check" until a person records the check in `checkedBy`.

## Layout

```
app/[locale]/        pages: Spain dashboard, spain/[topic], parties, compare, about, methodology, sources, corrections
app/csv/[file]       static CSV download per indicator
components/          cards, server-rendered Observable Plot charts, hover layer, party menu, source footer
lib/                 schemas (Zod), data loading, formatting, dashboard layout
messages/            es, en, ca
data/                raw/, indicators/, distributions/, pyramids/, estimates/, sources.json, parties/, proposals/, assessments/, events.json, corrections.json
sources/programs/    archived party programmes ({party}/{edition}/)
sources/documents/   archived reports and laws behind data/estimates
methodology/         rubric.v1.json and README.md
```

## Licences

Code: MIT ([LICENSE](LICENSE)). Derived data in `data/indicators`, `data/proposals` and `data/assessments`: CC BY 4.0. Source data belong to their publishers and are reused under their terms (INE: CC BY 4.0, "Fuente: INE"; Eurostat and the European Commission: CC BY 4.0; Banco de España, AEAT, Seguridad Social, Ministerio del Interior, Ministerio de Transportes, MIVAU, AIReF: reuse with attribution). The project accepts no funding, advertising or endorsement from political parties.
