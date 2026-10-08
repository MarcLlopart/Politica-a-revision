import Link from "next/link";
import { useLocale } from "next-intl";
import type { ComponentProps } from "react";

/**
 * Server-side link that prefixes the current locale ("/parties" → "/es/parties").
 * Used instead of next-intl's client navigation so no i18n runtime ships to the browser.
 */
export function LocaleLink({ href, ...rest }: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const locale = useLocale();
  return <Link href={`/${locale}${href === "/" ? "" : href}`} {...rest} />;
}
