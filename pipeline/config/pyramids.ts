// Population pyramids: population by sex and single year of age for a few dates.

import type { Localized } from "../../lib/schema";
import { inePyramidYear, type PyramidResource } from "../lib/pyramid";

export type PyramidDef = {
  id: string;
  label: Localized;
  note?: Localized;
  method: string;
  /** Years up to and including this one are observed (the projection's base year). */
  observedUntil: string;
  years: { period: string; resource: PyramidResource }[];
};

const PROJECTION_DATASET = "Proyecciones de Población 2026–2076";

export const PYRAMIDS: PyramidDef[] = [
  {
    id: "population-projection",
    label: {
      es: "Población por edad y sexo (proyección INE 2026–2076)",
      en: "Population by age and sex (INE projection 2026–2076)",
      ca: "Població per edat i sexe (projecció INE 2026–2076)",
    },
    note: {
      es: "Población residente a 1 de enero. 2026 es el año base de la proyección; los años siguientes son proyección del INE si se mantienen las tendencias demográficas actuales (fecundidad, mortalidad y migración).",
      en: "Resident population on 1 January. 2026 is the projection's base year; later years are INE's projection if current demographic trends (fertility, mortality and migration) continue.",
      ca: "Població resident a 1 de gener. El 2026 és l'any base de la projecció; els anys següents són projecció de l'INE si es mantenen les tendències demogràfiques actuals (fecunditat, mortalitat i migració).",
    },
    method: "Population by sex and single year of age (0–99, 100 and over) on 1 January, INE Proyecciones de Población 2026–2076 (table 36643), as published.",
    observedUntil: "2026",
    years: ["2026", "2030", "2036", "2046"].map((period) => ({
      period,
      resource: inePyramidYear({ tableId: "36643", year: period, dataset: PROJECTION_DATASET }),
    })),
  },
];
