import { ArrowLeft, Home } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";
import AppShell from "@/components/AppShell";
import { useLang } from "@/i18n/LanguageContext";
import "./notfound.css";

const NOT_FOUND_PATH = "/404";

export default function NotFound() {
  const { t } = useLang();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    if (window.location.pathname.replace(/\/$/, "") !== NOT_FOUND_PATH) {
      window.location.replace(NOT_FOUND_PATH);
    }
    return () => robots.remove();
  }, []);

  return (
    <AppShell>
      <div className="ng404">
        <section className="page_404">
          <div className="four_zero_four_bg">
            <h1>404</h1>
          </div>
          <div className="contant_box_404">
            <span className="nf-kicker">{t("nf.kicker")}</span>
            <h3>{t("nf.title")}</h3>
            <p>{t("nf.sub")}</p>
            <div>
              <Link href="/" className="link_404"><Home size={16} /> {t("nf.home")}</Link>
              <button className="link_ghost_404" onClick={() => window.history.length > 1 ? window.history.back() : setLocation("/")}><ArrowLeft size={16} /> {t("nf.back")}</button>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
