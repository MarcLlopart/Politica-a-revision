// Topic taxonomy (brief §4). Topic slugs are used in URLs and data files.

export const TOPICS = [
  "economy",
  "cost-of-living",
  "public-finances",
  "public-spending",
  "housing",
  "pensions",
  "labour",
  "income",
  "demographics",
  "births-deaths",
  "immigration",
  "emigration",
  "safety",
] as const;

export type Topic = (typeof TOPICS)[number];

export function isTopic(value: string): value is Topic {
  return (TOPICS as readonly string[]).includes(value);
}
