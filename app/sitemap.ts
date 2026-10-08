import type { MetadataRoute } from "next";
import { getPartiesFile } from "@/lib/data";
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locales";
import { SITE } from "@/lib/site";
import { TOPICS } from "@/lib/topics";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "",
    "/parties",
    "/compare",
    "/about",
    "/methodology",
    "/sources",
    "/corrections",
    ...TOPICS.map((t) => `/spain/${t}`),
    ...TOPICS.map((t) => `/compare/${t}`),
    ...getPartiesFile().parties.map((p) => `/parties/${p.id}`),
  ];
  return paths.map((path) => ({
    url: `${SITE.url}/${DEFAULT_LOCALE}${path}`,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, `${SITE.url}/${l}${path}`])) },
  }));
}
