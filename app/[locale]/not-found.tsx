import { useTranslations } from "next-intl";
import { LocaleLink as Link } from "@/components/LocaleLink";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <div className="max-w-xl">
      <h1>{t("title")}</h1>
      <p className="mt-2 text-[var(--ink-2)]">{t("body")}</p>
      <p className="mt-4">
        <Link href="/">{t("home")}</Link>
      </p>
    </div>
  );
}
