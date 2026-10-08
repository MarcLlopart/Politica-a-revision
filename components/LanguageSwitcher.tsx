"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/lib/locales";

/** Always-visible language links; each keeps the reader on the same page. */
export function LanguageSwitcher({ label, current }: { label: string; current: Locale }) {
  const rest = usePathname().replace(/^\/[a-z]{2}(?=\/|$)/, "");
  return (
    <nav aria-label={label}>
      <ul className="flex items-center gap-0.5 text-sm">
        {LOCALES.map((l) => (
          <li key={l}>
            <Link
              href={`/${l}${rest}`}
              hrefLang={l}
              lang={l}
              aria-current={l === current ? "true" : undefined}
              title={LOCALE_NAMES[l]}
              className="lang-link rounded px-2 py-1.5 uppercase"
            >
              <span aria-hidden="true">{l}</span>
              <span className="sr-only">{LOCALE_NAMES[l]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
