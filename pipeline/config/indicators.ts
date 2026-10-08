// Every published indicator, in dependency order (derived indicators after their inputs).

import type { IndicatorDef } from "../lib/define";
import { COST_OF_LIVING } from "./cost-of-living";
import { DEMOGRAPHY_MIGRATION } from "./demography-migration";
import { FORECASTS } from "./forecasts";
import { ECONOMY_LABOUR } from "./economy-labour";
import { HOUSING_FINANCE } from "./housing-finance";
import { INCOME } from "./income";
import { LABOUR_QUALITY } from "./labour-quality";
import { PENSIONS } from "./pensions";
import { SAFETY } from "./safety";
import { SALARIES } from "./salaries";
import { SPENDING } from "./spending";

export const INDICATORS: IndicatorDef[] = [...ECONOMY_LABOUR, ...DEMOGRAPHY_MIGRATION, ...HOUSING_FINANCE, ...PENSIONS, ...INCOME, ...SPENDING, ...LABOUR_QUALITY, ...SALARIES, ...SAFETY, ...COST_OF_LIVING, ...FORECASTS];

const ids = new Set<string>();
for (const def of INDICATORS) {
  if (ids.has(def.id)) throw new Error(`Duplicate indicator id ${def.id}`);
  ids.add(def.id);
}
