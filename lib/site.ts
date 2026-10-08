// Site-wide constants.

export const SITE = {
  name: "Política a revisión",
  repo: "MarcLlopart/data-elections-26",
  repoUrl: "https://github.com/MarcLlopart/data-elections-26",
  // Canonical origin: explicit setting, else the Vercel production domain, else the planned one.
  url:
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "https://politica-a-revision.vercel.app"),
};

/** Commit the deployment was built from, so raw-file links point at the exact bytes used. */
export const COMMIT = process.env.VERCEL_GIT_COMMIT_SHA ?? "main";

export function repoFileUrl(path: string): string {
  return `${SITE.repoUrl}/blob/${COMMIT}/${path.replace(/^\/+/, "")}`;
}

/** Opens the "Report an error" GitHub issue form, prefilled with what the reader was looking at. */
export function reportErrorUrl(subject: string, pageUrl: string): string {
  const params = new URLSearchParams({
    template: "report-error.yml",
    title: `[Error] ${subject}`,
    item: subject,
    page: pageUrl,
  });
  return `${SITE.repoUrl}/issues/new?${params.toString()}`;
}
