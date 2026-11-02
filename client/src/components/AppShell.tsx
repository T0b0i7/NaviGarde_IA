import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Anchor, Bell, CalendarDays, ChevronDown, ClipboardList, FileText,
  Grid2X2, History, LifeBuoy, Menu, Search, Settings, ShipWheel, SlidersHorizontal,
  CheckCheck, CircleAlert, Clock3, Moon, Sun, Users, Waves, X, type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { canAccess, roleLabel, type AppRole } from "@shared/rbac";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const navItems: { label: string; icon: LucideIcon; href?: string; badge?: string }[] = [
  { label: "Tableau de bord", icon: Grid2X2, href: "/" },
  { label: "Inspections", icon: Search, href: "/inspections/new" },
  { label: "Alertes", icon: Bell, href: "/alertes", badge: "5" },
  { label: "Rapports", icon: FileText, href: "/rapports" },
  { label: "Embarcations", icon: ShipWheel, href: "/embarcations" },
  { label: "Bulletins maritimes", icon: ClipboardList, href: "/bulletins" },
  { label: "Utilisateurs", icon: Users, href: "/utilisateurs" },
  { label: "Journal d’audit", icon: History, href: "/audit" },
  { label: "Paramètres", icon: Settings, href: "/parametres" },
];

type AppNotification = { id: number; title: string; text: string; time: string; tone: "critical" | "warning" | "info"; href: string; read: boolean };
const initialNotifications: AppNotification[] = [
  { id: 1, title: "Alerte de détresse", text: "Pirogue N°BK-0421 · Zone de Cotonou", time: "Il y a 12 min", tone: "critical", href: "/alertes", read: false },
  { id: 2, title: "Rapport à valider", text: "RPT-2025-0042 · Inspection à risque élevé", time: "Il y a 28 min", tone: "warning", href: "/rapports", read: false },
  { id: 3, title: "Analyse IA terminée", text: "Diagnostic photo disponible pour BN-1187", time: "Il y a 45 min", tone: "info", href: "/inspections/new", read: false },
  { id: 4, title: "Bulletin météo publié", text: "Vigilance renforcée sur le littoral", time: "Il y a 1 h", tone: "info", href: "/bulletins", read: true },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsQuery = trpc.data.notifications.list.useQuery(undefined, { retry: false });
  const utils = trpc.useUtils();
  const markRead = trpc.data.notifications.markRead.useMutation({ onSuccess: () => utils.data.notifications.list.invalidate() });
  const markAllRead = trpc.data.notifications.markAllRead.useMutation({ onSuccess: () => utils.data.notifications.list.invalidate() });
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => navigate("/connexion") });
  const session = meQuery.data;
  const { theme, toggleTheme } = useTheme();
  const role: AppRole = roleLabel(session?.appRole) ?? "Observateur";
  const visibleNavItems = navItems.filter((item) => !item.href || canAccess(role, item.href));
  const notifications: AppNotification[] = notificationsQuery.data?.map((notification) => ({ id: notification.id, title: notification.title, text: notification.message, time: new Date(notification.createdAt).toLocaleString("fr-FR"), tone: notification.type.includes("critical") || notification.type.includes("alert") ? "critical" : notification.type.includes("report") ? "warning" : "info", href: notification.href ?? "/", read: Boolean(notification.readAt) })) ?? initialNotifications;
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const active = location.startsWith("/inspections") ? "Inspections" : location.startsWith("/alertes") ? "Alertes" : location.startsWith("/rapports") ? "Rapports" : location.startsWith("/embarcations") ? "Embarcations" : location.startsWith("/bulletins") ? "Bulletins maritimes" : location.startsWith("/utilisateurs") ? "Utilisateurs" : location.startsWith("/audit") ? "Journal d’audit" : location.startsWith("/parametres") ? "Paramètres" : "Tableau de bord";

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand-block">
          <div className="brand-mark"><Waves size={34} strokeWidth={1.8} /><Anchor size={15} className="brand-anchor" /></div>
          <div><strong>NaviGarde IA</strong><span>Sécurité maritime · Bénin</span></div>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu"><X size={20} /></button>
        </div>
        <nav className="main-nav">
          {visibleNavItems.map(({ label, icon: Icon, href, badge }) => {
            const item = <><Icon size={20} /><span>{label}</span>{badge && <b className="nav-badge">{badge}</b>}</>;
            return href ? <Link key={label} href={href} onClick={() => setMobileOpen(false)} className={`nav-item ${active === label ? "active" : ""}`}>{item}</Link> : <button key={label} className="nav-item nav-button">{item}</button>;
          })}
        </nav>
        <div className="sidebar-footer"><div className="wave-footer"><Waves size={82} strokeWidth={1.5} /></div><p>Des mers plus sûres<br />pour un avenir durable</p></div>
      </aside>
      {mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" />}
      <main className="app-main">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu"><Menu size={22} /></button>
          <div className="search-bar"><Search size={20} /><input placeholder="Rechercher une embarcation, une alerte, un rapport..." /></div>
          <div className="top-actions"><button className="mode-toggle" aria-label={`Passer en mode ${theme === "light" ? "sombre" : "clair"}`} onClick={() => { const next = theme === "light" ? "sombre" : "clair"; toggleTheme?.(); toast.success(`Mode ${next} activé`); }}>{theme === "light" ? <Moon size={15} /> : <Sun size={15} />}<span /></button><span className="top-divider" /><div className="notification-wrap"><button className={`icon-button notification ${notificationsOpen ? "active" : ""}`} aria-label={`${unreadCount} notifications non lues`} onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }}><Bell size={22} />{unreadCount > 0 && <b>{unreadCount}</b>}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-head"><div><strong>Notifications</strong><small>{unreadCount ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est lu"}</small></div><button onClick={() => { markAllRead.mutate(); toast.success("Notifications marquées comme lues"); }} disabled={!unreadCount}><CheckCheck size={15} /> Tout lire</button></div><div className="notification-list">{notifications.map((notification) => <Link key={notification.id} href={notification.href} className={`notification-item ${notification.read ? "read" : ""}`} onClick={() => { markRead.mutate({ id: notification.id }); setNotificationsOpen(false); }}><span className={`notification-icon ${notification.tone}`}>{notification.tone === "critical" ? <CircleAlert size={16} /> : notification.tone === "warning" ? <Bell size={16} /> : <Clock3 size={16} />}</span><span className="notification-copy"><strong>{notification.title}</strong><small>{notification.text}</small><em>{notification.time}</em></span>{!notification.read && <i />}</Link>)}</div><Link href="/alertes" className="notification-footer" onClick={() => setNotificationsOpen(false)}>Ouvrir le centre d’alertes <ChevronDown size={14} /></Link></div>}</div><div className="profile-wrap"><button className="profile" onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }}><div className="avatar">{(session?.name ?? "NG").slice(0, 2).toUpperCase()}</div><div><strong>{session?.name ?? "Utilisateur NaviGarde"}</strong><small>{role}</small></div><ChevronDown size={16} /></button>{profileOpen && <div className="profile-menu"><span className="profile-menu-label">Session active · {role}</span>{canAccess(role, "/parametres") && <Link href="/parametres" onClick={() => setProfileOpen(false)}><Settings size={15} /> Paramètres du compte</Link>}<button onClick={() => { logoutMutation.mutate(); toast.success("Session fermée"); }}><LifeBuoy size={15} /> Se déconnecter</button></div>}</div></div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
