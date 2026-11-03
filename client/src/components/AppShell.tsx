import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Bell, CheckCheck, ChevronDown, ChevronRight, ChevronsLeft, CircleAlert, ClipboardList, Clock3, FileText, History, LifeBuoy, Menu, Search, Settings, ShipWheel, Users, X, type LucideIcon, LayoutDashboard, ScanSearch } from "lucide-react";
import { canAccess, roleLabel, type AppRole } from "@shared/rbac";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageContext";
import LangSelect from "@/components/LangSelect";
import ThemeSplitToggle from "@/components/ThemeSplitToggle";
import logoIcon from "@/assets/logo-icon.png";

const NAV: { key: string; icon: LucideIcon; href: string; match: (p: string) => boolean }[] = [
  { key: "nav.dashboard", icon: LayoutDashboard, href: "/", match: (p) => p === "/" },
  { key: "nav.inspections", icon: ScanSearch, href: "/inspections", match: (p) => p.startsWith("/inspections") },
  { key: "nav.alerts", icon: Bell, href: "/alertes", match: (p) => p.startsWith("/alertes") },
  { key: "nav.reports", icon: FileText, href: "/rapports", match: (p) => p.startsWith("/rapports") },
  { key: "nav.vessels", icon: ShipWheel, href: "/embarcations", match: (p) => p.startsWith("/embarcations") },
  { key: "nav.bulletins", icon: ClipboardList, href: "/bulletins", match: (p) => p.startsWith("/bulletins") },
  { key: "nav.users", icon: Users, href: "/utilisateurs", match: (p) => p.startsWith("/utilisateurs") },
  { key: "nav.audit", icon: History, href: "/audit", match: (p) => p.startsWith("/audit") },
  { key: "nav.settings", icon: Settings, href: "/parametres", match: (p) => p.startsWith("/parametres") },
];

type AppNotification = { id: number; title: string; text: string; time: string; tone: "critical" | "warning" | "info"; href: string; read: boolean };

export default function AppShell({ children }: { children: ReactNode }) {
  const { t, locale } = useLang();
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("navigarde_sidebar") === "rail";
    } catch {
      return false;
    }
  });
  const toggleRail = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("navigarde_sidebar", c ? "full" : "rail");
      } catch {}
      return !c;
    });
  };
  const notificationsQuery = trpc.data.notifications.list.useQuery(undefined, { retry: false, refetchInterval: 30000 });
  const alertsQuery = trpc.data.alerts.list.useQuery({ limit: 50, offset: 0 }, { retry: false, refetchInterval: 30000 });
  const utils = trpc.useUtils();
  const markRead = trpc.data.notifications.markRead.useMutation({ onSuccess: () => utils.data.notifications.list.invalidate() });
  const markAllRead = trpc.data.notifications.markAllRead.useMutation({ onSuccess: () => utils.data.notifications.list.invalidate() });
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => navigate("/connexion") });
  const session = meQuery.data;
  const role: AppRole = roleLabel(session?.appRole) ?? "Observateur";
  const roleCode = (session?.appRole ?? "observer") as "agent" | "supervisor" | "admin" | "observer";
  const roleName = t(`role.${roleCode}`);
  const visibleNav = NAV.filter((item) => canAccess(role, item.href));
  const mainNav = visibleNav.filter((n) => n.key !== "nav.settings");
  const sysNav = visibleNav.filter((n) => n.key === "nav.settings");
  const renderNavItem = (key: string, Icon: LucideIcon, href: string) => {
    const item = NAV.find((n) => n.key === key)!;
    const label = t(key);
    const badge = key === "nav.alerts" && openAlerts > 0 ? String(openAlerts) : undefined;
    return <Link key={key} href={href} data-tip={label} onClick={() => setMobileOpen(false)} className={`nav-item${item.match(location) ? " active" : ""}`}><Icon size={20} /><span className="nav-label">{label}</span>{badge && <b className="nav-badge">{badge}</b>}</Link>;
  };
  const notifications: AppNotification[] = (notificationsQuery.data ?? []).map((n) => ({ id: n.id, title: n.title, text: n.message, time: new Date(n.createdAt).toLocaleString(locale), tone: n.type.includes("critical") || n.type.includes("alert") ? "critical" : n.type.includes("report") ? "warning" : "info", href: n.href ?? "/", read: Boolean(n.readAt) }));

  const unreadCount = notifications.filter((n) => !n.read).length;
  const openAlerts = (alertsQuery.data ?? []).filter((a) => a.status === "nouvelle" || a.status === "en_cours").length;

  return (
    <div className={`app-shell${collapsed ? " rail" : ""}`}>
      <aside className={`sidebar${mobileOpen ? " sidebar-open" : ""}${collapsed ? " sidebar-rail" : ""}`}>
        <button className="rail-toggle" onClick={toggleRail} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand" : "Collapse"}>
          <ChevronsLeft size={16} className={`rail-chevron${collapsed ? " flipped" : ""}`} />
        </button>
        <div className="brand-block">
          <img src={logoIcon} alt="NaviGarde IA" className="brand-logo" />
          <div className="brand-text"><strong>NaviGarde IA</strong><span>{t("nav.brandSub")}</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav className="main-nav">
          <div className="nav-section">{t("nav.menu")}</div>
          {mainNav.map(({ key, icon: Icon, href }) => renderNavItem(key, Icon, href))}
          {sysNav.length > 0 && (
            <>
              <div className="nav-section">{t("nav.system")}</div>
              {sysNav.map(({ key, icon: Icon, href }) => renderNavItem(key, Icon, href))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <Link href="/parametres" onClick={() => setMobileOpen(false)} className="side-user">
            <span className="avatar">{(session?.name ?? "NG").slice(0, 2).toUpperCase()}</span>
            <span className="side-user-body"><strong>{session?.name ?? "User"}</strong><small>{roleName}</small></span>
            <ChevronRight size={15} />
          </Link>
          <img src={logoIcon} alt="NaviGarde IA" className="rail-mini-logo" />
        </div>
      </aside>
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu" />}
      <main className="app-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="search-bar"><Search size={20} /><input placeholder={t("top.search")} onKeyDown={(e) => { if (e.key === "Enter") navigate("/embarcations"); }} /></div>
          <div className="top-actions">
            <ThemeSplitToggle />
            <LangSelect />
            <span className="top-divider" />
            <div className="notification-wrap">
              <button className={`icon-button notification ${notificationsOpen ? "active" : ""}`} aria-label={`${unreadCount} notifications`} onClick={() => { setNotificationsOpen((o) => !o); setProfileOpen(false); }}><Bell size={22} />{unreadCount > 0 && <b>{unreadCount}</b>}</button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="notification-head"><div><strong>{t("top.notifications")}</strong><small>{unreadCount ? t("top.unread", { n: unreadCount }) : notifications.length === 0 ? t("top.noNotif") : t("top.allRead")}</small></div><button onClick={() => { markAllRead.mutate(); }} disabled={!unreadCount}><CheckCheck size={15} /> {t("top.markAll")}</button></div>
                  <div className="notification-list">
                    {notifications.length === 0 ? <div style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--ng-text-muted)", fontSize: 13 }}>{t("top.noNotif")}<br />{t("top.noNotifHint")}</div>
                    : notifications.map((n) => <Link key={n.id} href={n.href} className={`notification-item ${n.read ? "read" : ""}`} onClick={() => { if (!n.read) markRead.mutate({ id: n.id }); setNotificationsOpen(false); }}><span className={`notification-icon ${n.tone}`}>{n.tone === "critical" ? <CircleAlert size={16} /> : n.tone === "warning" ? <Bell size={16} /> : <Clock3 size={16} />}</span><span className="notification-copy"><strong>{n.title}</strong><small>{n.text}</small><em>{n.time}</em></span>{!n.read && <i />}</Link>)}
                  </div>
                  <Link href="/alertes" className="notification-footer" onClick={() => setNotificationsOpen(false)}>{t("top.openAlerts")} <ChevronDown size={14} /></Link>
                </div>
              )}
            </div>
            <div className="profile-wrap">
              <button className="profile" onClick={() => { setProfileOpen((o) => !o); setNotificationsOpen(false); }}><div className="avatar">{(session?.name ?? "NG").slice(0, 2).toUpperCase()}</div><div><strong>{session?.name ?? "User"}</strong><small>{roleName}</small></div><ChevronDown size={16} /></button>
              {profileOpen && <div className="profile-menu"><span className="profile-menu-label">{t("top.sessionRole")} · {roleName}</span>{canAccess(role, "/parametres") && <Link href="/parametres" onClick={() => setProfileOpen(false)}><Settings size={15} /> {t("top.mySettings")}</Link>}<button onClick={() => { logoutMutation.mutate(); toast.success(t("top.sessionClosed")); }}><LifeBuoy size={15} /> {t("top.logout")}</button></div>}
            </div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
