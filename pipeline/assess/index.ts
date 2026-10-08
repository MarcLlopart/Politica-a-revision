// Applies the frozen rubric to reviewed proposals (milestone M3).
// Guard first: the rubric must be frozen before any assessment is produced, so the
// method cannot be tuned after seeing results.

import { getProposals, getRubric } from "../../lib/data";

const rubric = getRubric();
if (rubric.status !== "frozen" || !rubric.frozenAt) {
  console.error(
    `Rubric v${rubric.version} is "${rubric.status}". Freeze it (status "frozen" + frozenAt) in a commit of its own before running assessments.`,
  );
  process.exit(1);
}

const reviewed = getProposals().filter((p) => p.status !== "draft");
console.log(`Rubric v${rubric.version} frozen on ${rubric.frozenAt}. ${reviewed.length} reviewed proposals.`);
console.error("Assessment generation is not implemented yet (milestone M3).");
process.exit(1);
