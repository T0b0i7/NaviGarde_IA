import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import NewInspection from "./pages/NewInspection";
import { AlertsPage, AuditPage, MarinAlertPage, ReportsPage, UsersPage, VesselsPage } from "./pages/Operations";
import { BulletinsPage } from "./pages/BulletinsPage";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Forbidden from "./pages/Forbidden";
import InspectionDetail from "./pages/InspectionDetail";
import ReportsCenter from "./pages/ReportsCenter";
import VesselsCenter from "./pages/VesselsCenter";
import VesselDetail from "./pages/VesselDetail";
import { canAccess, roleLabel } from "@shared/rbac";
import { trpc } from "./lib/trpc";
import { useEffect, useState } from "react";

function AuthGate({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const [checking, setChecking] = useState(true);
  const publicRoute = location === "/connexion" || location === "/marin/alerte";
  useEffect(() => {
    if (publicRoute || location === "/forbidden") { setChecking(false); return; }
    if (meQuery.isLoading) return;
    const role = roleLabel(meQuery.data?.appRole);
    if (!meQuery.data || !role) { navigate("/connexion"); return; }
    if (!canAccess(role, location)) { navigate("/forbidden"); return; }
    setChecking(false);
  }, [location, navigate, publicRoute, meQuery.data, meQuery.isLoading]);
  if (checking && !publicRoute && location !== "/forbidden") return null;
  return <>{children}</>;
}

function Router() {
  return <Switch><Route path="/connexion" component={Login} /><Route path="/marin/alerte" component={MarinAlertPage} /><Route path="/forbidden" component={Forbidden} /><Route path="/" component={Home} /><Route path="/inspections/new" component={NewInspection} /><Route path="/inspections/:id" component={InspectionDetail} /><Route path="/alertes" component={AlertsPage} /><Route path="/rapports" component={ReportsCenter} /><Route path="/embarcations/:id" component={VesselDetail} /><Route path="/embarcations" component={VesselsCenter} /><Route path="/bulletins" component={BulletinsPage} /><Route path="/utilisateurs" component={UsersPage} /><Route path="/audit" component={AuditPage} /><Route path="/parametres" component={Settings} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light" switchable><TooltipProvider><Toaster /><AuthGate><Router /></AuthGate></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
