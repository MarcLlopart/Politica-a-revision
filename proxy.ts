import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Redirects "/" and unprefixed paths to a locale (Accept-Language, then default "es")
// and adds hreflang alternate links to responses.
export default createMiddleware(routing);

export const config = {
  // Skip Next internals, CSV downloads and any path with a file extension.
  matcher: "/((?!_next|_vercel|csv|.*\\..*).*)",
};
