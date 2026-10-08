import type { Party } from "@/lib/schema";

/** The only place a party colour appears (brief §2). */
export function PartyChip({ party }: { party: Party }) {
  return (
    <span className="chip">
      <span className="chip-dot" style={{ background: party.color }} aria-hidden="true" />
      {party.acronym}
    </span>
  );
}
