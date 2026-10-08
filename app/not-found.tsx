import Link from "next/link";
import "./globals.css";

// Fallback for requests outside any locale (the proxy normally redirects them to one).
// Kept static and trilingual because no locale is known here.
export default function GlobalNotFound() {
  return (
    <html lang="es">
      <body className="mx-auto max-w-xl p-8">
        <h1>404</h1>
        <ul className="mt-4 space-y-2">
          <li lang="es">
            <Link href="/es">Página no encontrada. Ir a la página principal</Link>
          </li>
          <li lang="en">
            <Link href="/en">Page not found. Go to the home page</Link>
          </li>
          <li lang="ca">
            <Link href="/ca">No s&apos;ha trobat la pàgina. Ves a la pàgina principal</Link>
          </li>
        </ul>
      </body>
    </html>
  );
}
