// Cost of living: consumer prices by spending group and for everyday items (INE CPI, base
// 2025, back-cast by INE to 2002), prices against incomes since 2018, and how households
// cope (Eurostat EU-SILC: making ends meet, unexpected expenses, heating, arrears, housing costs).
// Codes verified on 2026-10-08.

import type { Localized } from "../../lib/schema";
import type { IndicatorDef } from "../lib/define";
import { eurostat, ineSeries, type Point } from "../lib/sources";

const L = (es: string, en: string, ca: string): Localized => ({ es, en, ca });

/** CPI index (2025 = 100), monthly. Groups are in table 76125, subclasses in 76128. */
const index = (id: string, code: string, table: "76125" | "76128", label: Localized, what: string): IndicatorDef => ({
  id,
  topic: "cost-of-living",
  unit: "index",
  frequency: "M",
  decimals: 1,
  yZero: false,
  label,
  method: `Consumer Price Index, ${what}, national, monthly index (2025 = 100), as published by INE (table ${table}). INE back-casts the 2025 base to earlier years.`,
  resource: ineSeries({ code, tableId: table }),
});

/** CPI annual rate (year on year), monthly. */
const annualRate = (id: string, code: string, table: "76125" | "76128", label: Localized, what: string): IndicatorDef => ({
  id,
  topic: "cost-of-living",
  unit: "percent_change",
  frequency: "M",
  decimals: 1,
  yZero: true,
  label,
  method: `Annual change in the Consumer Price Index, ${what}, national, as published by INE (table ${table}).`,
  resource: ineSeries({ code, tableId: table }),
});

/** Rebases an annual series to 2018 = 100. */
const rebase2018 = ([points]: Point[][]) => {
  const base = points.find((p) => p.period === "2018");
  if (!base) throw new Error("rebase2018: no 2018 value");
  return points.filter((p) => p.period >= "2018").map((p) => ({ ...p, value: (p.value / base.value) * 100 }));
};

const rebased = (id: string, input: string, label: Localized, what: string): IndicatorDef => ({
  id,
  topic: "cost-of-living",
  unit: "index",
  frequency: "A",
  decimals: 1,
  yZero: false,
  label,
  method: `${what} rebased to 2018 = 100 (value ÷ value in 2018 × 100), from the indicator "${input}".`,
  inputs: [input],
  formula: "value ÷ value(2018) × 100",
  compute: rebase2018,
});

const SILC_NOTE = L(
  "Encuesta de Condiciones de Vida (EU-SILC). Cada año se refiere al momento de la entrevista; las preguntas sobre ingresos, al año anterior.",
  "EU Statistics on Income and Living Conditions (EU-SILC). Each year refers to the time of the interview; income questions refer to the previous year.",
  "Enquesta de Condicions de Vida (EU-SILC). Cada any es refereix al moment de l'entrevista; les preguntes sobre ingressos, a l'any anterior.",
);

const silc = (id: string, dataset: string, filters: Record<string, string>, label: Localized, method: string): IndicatorDef => ({
  id,
  topic: "cost-of-living",
  unit: "percent",
  frequency: "A",
  decimals: 1,
  yZero: true,
  label,
  note: SILC_NOTE,
  method: `${method}, Eurostat ${dataset} (Spain).`,
  resource: eurostat({ sourceId: `eurostat-${dataset}-${Object.values(filters).join("-")}-es`.toLowerCase().replace(/[^a-z0-9]+/g, "-"), dataset, filters: { geo: "ES", freq: "A", unit: "PC", ...filters }, datasetLabel: method }),
});

export const COST_OF_LIVING: IndicatorDef[] = [
  annualRate("cpi-food-yoy", "IPC290754", "76125", L("Precio de los alimentos (interanual)", "Food prices (year on year)", "Preu dels aliments (interanual)"), "food and non-alcoholic beverages"),
  annualRate("cpi-electricity-yoy", "IPC291482", "76128", L("Electricidad", "Electricity", "Electricitat"), "electricity"),
  annualRate("cpi-natural-gas-yoy", "IPC291842", "76128", L("Gas natural", "Natural gas", "Gas natural"), "natural gas"),
  annualRate("cpi-diesel-yoy", "IPC291534", "76128", L("Gasóleo", "Diesel", "Gasoil"), "diesel"),
  annualRate("cpi-petrol-yoy", "IPC291538", "76128", L("Gasolina", "Petrol", "Gasolina"), "petrol"),

  // Spending groups (ECOICOP ver. 2).
  index("cpi-group-food", "IPC290755", "76125", L("Alimentos y bebidas no alcohólicas", "Food and non-alcoholic drinks", "Aliments i begudes no alcohòliques"), "food and non-alcoholic beverages"),
  index("cpi-group-alcohol-tobacco", "IPC290779", "76125", L("Bebidas alcohólicas y tabaco", "Alcohol and tobacco", "Begudes alcohòliques i tabac"), "alcoholic beverages and tobacco"),
  index("cpi-group-clothing", "IPC290759", "76125", L("Vestido y calzado", "Clothing and footwear", "Vestit i calçat"), "clothing and footwear"),
  index("cpi-group-housing", "IPC290763", "76125", L("Vivienda, agua, electricidad y gas", "Housing, water, electricity and gas", "Habitatge, aigua, electricitat i gas"), "housing, water, electricity, gas and other fuels"),
  index("cpi-group-furnishings", "IPC290767", "76125", L("Muebles y artículos del hogar", "Furnishings and household goods", "Mobles i articles de la llar"), "furnishings and household goods"),
  index("cpi-group-health", "IPC290771", "76125", L("Sanidad", "Health", "Sanitat"), "health"),
  index("cpi-group-transport", "IPC290775", "76125", L("Transporte", "Transport", "Transport"), "transport"),
  index("cpi-group-communications", "IPC290783", "76125", L("Información y comunicaciones", "Information and communication", "Informació i comunicacions"), "information and communication"),
  index("cpi-group-recreation", "IPC290787", "76125", L("Ocio, deporte y cultura", "Recreation, sport and culture", "Lleure, esport i cultura"), "recreation, sport and culture"),
  index("cpi-group-education", "IPC290791", "76125", L("Enseñanza", "Education", "Ensenyament"), "education"),
  index("cpi-group-restaurants", "IPC290795", "76125", L("Restaurantes y alojamiento", "Restaurants and accommodation", "Restaurants i allotjament"), "restaurants and accommodation services"),
  index("cpi-group-insurance", "IPC290799", "76125", L("Seguros y servicios financieros", "Insurance and financial services", "Assegurances i serveis financers"), "insurance and financial services"),
  index("cpi-group-personal", "IPC290803", "76125", L("Cuidado personal y otros", "Personal care and other", "Cura personal i altres"), "personal care, social protection and miscellaneous goods and services"),

  // Everyday items (subclasses).
  index("cpi-item-bread", "IPC291595", "76128", L("Pan y panadería", "Bread and bakery", "Pa i fleca"), "bread and bakery products"),
  index("cpi-item-milk", "IPC291643", "76128", L("Leche entera", "Whole milk", "Llet sencera"), "whole milk"),
  index("cpi-item-eggs", "IPC291439", "76128", L("Huevos", "Eggs", "Ous"), "eggs"),
  index("cpi-item-oils", "IPC291663", "76128", L("Aceites vegetales (incluye oliva)", "Vegetable oils (incl. olive oil)", "Olis vegetals (inclou oliva)"), "vegetable oils (including olive oil)"),
  index("cpi-item-sugar", "IPC291731", "76128", L("Azúcar", "Sugar", "Sucre"), "cane and beet sugar"),
  index("cpi-item-rent", "IPC291807", "76128", L("Alquiler de la vivienda habitual", "Rent of main home", "Lloguer de l'habitatge habitual"), "actual rent of the main home"),
  index("cpi-item-electricity", "IPC291483", "76128", L("Electricidad", "Electricity", "Electricitat"), "electricity"),
  index("cpi-item-gas", "IPC291843", "76128", L("Gas natural", "Natural gas", "Gas natural"), "natural gas"),
  index("cpi-item-diesel", "IPC291535", "76128", L("Gasóleo", "Diesel", "Gasoil"), "diesel"),
  index("cpi-item-petrol", "IPC291539", "76128", L("Gasolina", "Petrol", "Gasolina"), "petrol"),

  // Prices against incomes, 2018 = 100.
  rebased("prices-2018", "cpi-index-annual", L("Precios (IPC, media anual)", "Prices (CPI, annual average)", "Preus (IPC, mitjana anual)"), "INE CPI annual average"),
  rebased("minimum-wage-2018", "minimum-wage-monthly", L("Salario mínimo", "Minimum wage", "Salari mínim"), "Monthly minimum wage (Real Decreto)"),
  rebased("median-wage-2018", "wage-p50", L("Salario mediano", "Median wage", "Salari mitjà (mediana)"), "INE median gross annual earnings"),
  rebased("household-income-2018", "household-income-p50", L("Renta mediana de los hogares", "Median household income", "Renda mediana de les llars"), "Median equivalised net household income (Eurostat EU-SILC)"),

  // How households cope.
  silc("ends-meet-great-difficulty", "ilc_mdes09", { lev_diff: "GRT", hhcomp: "TOTAL", rskpovth: "TOTAL" }, L("Con mucha dificultad", "With great difficulty", "Amb molta dificultat"), "Share of the population in households making ends meet with great difficulty"),
  silc("ends-meet-difficulty", "ilc_mdes09", { lev_diff: "DIF", hhcomp: "TOTAL", rskpovth: "TOTAL" }, L("Con dificultad", "With difficulty", "Amb dificultat"), "Share of the population in households making ends meet with difficulty"),
  silc("unexpected-expenses", "ilc_mdes04", { hhcomp: "TOTAL", rskpovth: "TOTAL" }, L("No pueden afrontar un gasto imprevisto", "Cannot face an unexpected expense", "No poden afrontar una despesa imprevista"), "Share of the population unable to face unexpected financial expenses"),
  silc("home-not-warm", "ilc_mdes01", { hhcomp: "TOTAL", rskpovth: "TOTAL" }, L("No pueden mantener la vivienda a una temperatura adecuada", "Cannot keep their home adequately warm", "No poden mantenir l'habitatge a una temperatura adequada"), "Share of the population unable to keep the home adequately warm"),
  silc("utility-arrears", "ilc_mdes07", { hhcomp: "TOTAL", rskpovth: "TOTAL" }, L("Retrasos en recibos de luz, agua o gas", "Arrears on utility bills", "Endarreriments en rebuts de llum, aigua o gas"), "Share of the population with arrears on utility bills"),
  silc("housing-overburden-total", "ilc_lvho07c", { tenure: "TOTAL" }, L("Toda la población", "Whole population", "Tota la població"), "Housing cost overburden rate (housing costs above 40% of disposable income), all tenure statuses"),
  silc("housing-overburden-renters", "ilc_lvho07c", { tenure: "RENT_MKT" }, L("Inquilinos a precio de mercado", "Tenants paying market rent", "Llogaters a preu de mercat"), "Housing cost overburden rate, tenants paying market rent"),
  silc("housing-overburden-mortgage", "ilc_lvho07c", { tenure: "OWN_L" }, L("Propietarios con hipoteca", "Owners with a mortgage", "Propietaris amb hipoteca"), "Housing cost overburden rate, owners with a mortgage or loan"),
];
