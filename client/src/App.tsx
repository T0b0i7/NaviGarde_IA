import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { canAccess, roleLabel } from "@shared/rbac";
import { trpc } from "./lib/trpc";
import { lazy, Suspense, useEffect, useState } from "react";

/**
 * Découpage par route : chaque écran devient un morceau téléchargé à la
 * demande. Le bundle initial ne contient plus que le shell (thème, auth,
 * navigation) au lieu des 1,1 Mo de toutes les pages réunies — dont Recharts,
 * dont seule la page courante a besoin.
 *
 * `Login` reste chargé d'emblée : c'est la première page de presque tous les
 * visiteurs, la différer coûterait un aller-retour de plus au premier écran.
 */
import Login from "./pages/Login";

const Home = lazy(() => import("./pages/Home"));
const NewInspection = lazy(() => import("./pages/NewInspection"));
const InspectionsPage = lazy(() => import("./pages/InspectionsPage"));
const InspectionDetail = lazy(() => import("./pages/InspectionDetail"));
const ReportsCenter = lazy(() => import("./pages/ReportsCenter"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const VesselsCenter = lazy(() => import("./pages/VesselsCenter"));
const VesselDetail = lazy(() => import("./pages/VesselDetail"));
const BulletinsPage = lazy(() => import("./pages/BulletinsPage").then((m) => ({ default: m.BulletinsPage })));
const Settings = lazy(() => import("./pages/Settings"));
const Forbidden = lazy(() => import("./pages/Forbidden"));
const NotFound = lazy(() => import("./pages/NotFound"));

/** `Operations.tsx` exporte plusieurs écrans : un seul morceau les regroupe. */
const AlertsPage = lazy(() => import("./pages/Operations").then((m) => ({ default: m.AlertsPage })));
const AuditPage = lazy(() => import("./pages/Operations").then((m) => ({ default: m.AuditPage })));
const UsersPage = lazy(() => import("./pages/Operations").then((m) => ({ default: m.UsersPage })));
const MarinAlertPage = lazy(() => import("./pages/Operations").then((m) => ({ default: m.MarinAlertPage })));

/** Écran de chargement d'un morceau, sobre et stable pour éviter tout saut. */
function PageFallback() {
  return (
    <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--ng-faint)" }}>
      <div style={{ display: "grid", gap: 10, justifyItems: "center" }}>
        <Spinner style={{ width: 22, height: 22 }} />
        <span style={{ fontSize: 12.5 }}>Chargement…</span>
      </div>
    </div>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false, staleTime: 0, refetchOnMount: "always" });
  const [checking, setChecking] = useState(true);
  const publicRoute = location === "/connexion" || location === "/marin/alerte";
  useEffect(() => {
    if (publicRoute || location === "/forbidden") { setChecking(false); return; }
    if (meQuery.isLoading || meQuery.isFetching) return;
    const role = roleLabel(meQuery.data?.appRole);
    if (!meQuery.data || !role) { navigate("/connexion"); return; }
    if (!canAccess(role, location)) { navigate("/forbidden"); return; }
    setChecking(false);
  }, [location, navigate, publicRoute, meQuery.data, meQuery.isLoading, meQuery.isFetching]);
  if (checking && !publicRoute && location !== "/forbidden") return null;
  return <>{children}</>;
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/connexion" component={Login} />
        <Route path="/marin/alerte" component={MarinAlertPage} />
        <Route path="/forbidden" component={Forbidden} />
        <Route path="/" component={Home} />
        <Route path="/inspections/new" component={NewInspection} />
        <Route path="/inspections" component={InspectionsPage} />
        <Route path="/inspections/:id" component={InspectionDetail} />
        <Route path="/alertes" component={AlertsPage} />
        <Route path="/rapports" component={ReportsCenter} />
        <Route path="/rapports/:id" component={ReportDetail} />
        <Route path="/embarcations/:id" component={VesselDetail} />
        <Route path="/embarcations" component={VesselsCenter} />
        <Route path="/bulletins" component={BulletinsPage} />
        <Route path="/utilisateurs" component={UsersPage} />
        <Route path="/audit" component={AuditPage} />
        <Route path="/parametres" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><AuthGate><Router /></AuthGate></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
