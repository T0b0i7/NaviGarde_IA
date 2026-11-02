export type AppRoleCode = "agent" | "supervisor" | "admin" | "observer";
export type AppRole = "Agent d'inspection" | "Superviseur" | "Administrateur" | "Observateur";

export const ROLE_LABELS: Record<AppRoleCode, AppRole> = {
  agent: "Agent d'inspection",
  supervisor: "Superviseur",
  admin: "Administrateur",
  observer: "Observateur",
};

export const ROLE_PERMISSIONS: Record<AppRole, string[]> = {
  "Agent d'inspection": ["/", "/inspections", "/alertes", "/embarcations", "/bulletins", "/marin/alerte"],
  Superviseur: ["/", "/inspections", "/alertes", "/rapports", "/embarcations", "/bulletins", "/audit", "/marin/alerte"],
  Administrateur: ["/", "/inspections", "/alertes", "/rapports", "/embarcations", "/bulletins", "/utilisateurs", "/audit", "/parametres", "/marin/alerte"],
  Observateur: ["/", "/rapports", "/embarcations", "/bulletins"],
};

export function roleLabel(value: unknown): AppRole | null {
  if (value === "agent" || value === "supervisor" || value === "admin" || value === "observer") return ROLE_LABELS[value];
  if (value === "Agent de terrain") return "Agent d'inspection";
  if (value === "Agent d'inspection" || value === "Superviseur" || value === "Administrateur" || value === "Observateur") return value;
  return null;
}

export function canAccess(role: AppRole, path: string) {
  return ROLE_PERMISSIONS[role].some((allowed) => allowed === "/" ? path === "/" : path.startsWith(allowed));
}
