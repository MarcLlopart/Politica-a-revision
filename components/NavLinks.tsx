"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/locales";

export type NavItem = { href: "/" | "/parties" | "/compare" | "/about"; label: string; icon: "spain" | "parties" | "compare" | "about" };

/** Path without the locale prefix: "/es/spain/economy" → "/spain/economy". */
function unprefixed(pathname: string): string {
  return pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/" || pathname.startsWith("/spain");
  return pathname === href || pathname.startsWith(`${href}/`);
}

const ICONS: Record<NavItem["icon"], string> = {
  spain: "M3 17l5-6 4 3 5-8 4 5", // a line chart
  parties: "M4 6h16M4 12h16M4 18h10", // a list
  compare: "M7 4v16M17 4v16M3 9h8M13 14h8", // side by side
  about: "M12 8h.01M11 12h1v5h1", // info
};

/** Top navigation on desktop (variant "top") and bottom tab bar on mobile (variant "bottom"). */
export function NavLinks({ items, label, variant, locale }: { items: NavItem[]; label: string; variant: "top" | "bottom"; locale: Locale }) {
  const pathname = unprefixed(usePathname());
  const href = (h: string) => `/${locale}${h === "/" ? "" : h}`;
  if (variant === "top") {
    return (
      <nav aria-label={label} className="hidden sm:block">
        <ul className="flex gap-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={href(item.href)}
                aria-current={isActive(pathname, item.href) ? "page" : undefined}
                className="nav-link rounded px-3 py-2 text-sm"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  return (
    <nav aria-label={label} className="bottom-nav fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[var(--page)] sm:hidden">
      <ul className="grid grid-cols-4">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={href(item.href)}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
              className="nav-tab flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {item.icon === "about" && <circle cx="12" cy="12" r="9" />}
                <path d={ICONS[item.icon]} />
              </svg>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
