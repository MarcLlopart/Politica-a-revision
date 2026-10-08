import { PartyChip } from "@/components/PartyChip";
import { PartySheet } from "@/components/PartySheet";
import { LocaleLink as Link } from "@/components/LocaleLink";
import { getPartiesFile } from "@/lib/data";
import type { Formatters } from "@/lib/i18n-server";

function PartyList({ currentId, f }: { currentId?: string; f: Formatters }) {
  const { parties } = getPartiesFile();
  return (
    <ul className="space-y-1">
      {parties.map((p) => (
        <li key={p.id}>
          <Link
            href={`/parties/${p.id}`}
            aria-current={p.id === currentId ? "page" : undefined}
            className="party-link flex min-h-11 items-center justify-between gap-2 rounded px-2 py-1.5 text-[var(--ink)] no-underline hover:bg-[var(--surface-2)] aria-[current=page]:bg-[var(--surface-2)] aria-[current=page]:font-semibold"
          >
            <span className="flex min-w-0 items-center gap-2">
              <PartyChip party={p} />
              <span className="truncate text-sm">{p.name}</span>
            </span>
            <span className="shrink-0 text-xs text-[var(--ink-2)] tabular-nums">{f.t("parties.seats", { count: p.seats2023 })}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Sidebar on desktop, bottom sheet on mobile. Same order and content on both. */
export function PartyMenu({ currentId, f }: { currentId?: string; f: Formatters }) {
  return (
    <>
      <PartySheet openLabel={f.t("parties.choose")} closeLabel={f.t("parties.close")} title={f.t("parties.menu")}>
        <PartyList currentId={currentId} f={f} />
      </PartySheet>
      <nav aria-label={f.t("parties.menu")} className="hidden sm:block">
        <PartyList currentId={currentId} f={f} />
      </nav>
    </>
  );
}
