import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createAlert, createMaritimeZone, createWeatherBulletin, listAlerts, listMaritimeZones, listVessels, listWeatherBulletins, saveVesselPosition } from "./db";
import { protectedProcedure, router, supervisorProcedure, adminAppProcedure as adminProcedure } from "./_core/trpc";

function pointInPolygon(point: [number, number], polygon: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j];
    const intersects = ((yi > point[1]) !== (yj > point[1])) && point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export const predictiveRouter = router({
  riskScore: protectedProcedure.input(z.object({ vesselId: z.number().int().positive(), declaredPassengers: z.number().int().nonnegative(), weatherPlace: z.string().min(2), windSpeed: z.number().nonnegative().default(0), waveHeight: z.number().nonnegative().default(0) })).query(async ({ input }) => {
    const vessels = await listVessels();
    const vessel = vessels.find((item) => item.id === input.vesselId);
    if (!vessel) throw new TRPCError({ code: "NOT_FOUND", message: "Embarcation introuvable." });
    const overload = vessel.capacity > 0 ? Math.max(0, Math.round((input.declaredPassengers / vessel.capacity) * 100 - 100)) : 50;
    const historyRisk = vessel.status === "sous_surveillance" ? 75 : vessel.status === "immobilisee" ? 100 : vessel.riskScore;
    const weatherRisk = Math.min(100, input.windSpeed * 2 + input.waveHeight * 20);
    const freshnessRisk = vessel.updatedAt && Date.now() - new Date(vessel.updatedAt).getTime() > 30 * 24 * 3600 * 1000 ? 60 : 10;
    const score = Math.min(100, Math.round(historyRisk * .35 + Math.min(100, overload * 2) * .25 + weatherRisk * .25 + freshnessRisk * .15));
    const level = score >= 75 ? "critique" : score >= 50 ? "eleve" : score >= 25 ? "moyen" : "faible";
    return { vesselId: vessel.id, registrationNumber: vessel.registrationNumber, score, level, canDepart: score < 75 && overload < 1 && input.windSpeed < 35, factors: { overload, historyRisk, weatherRisk, freshnessRisk }, recommendation: score >= 75 ? "Sortie interdite jusqu’à validation humaine et nouvelle inspection." : score >= 50 ? "Sortie déconseillée : contrôle superviseur recommandé." : "Sortie autorisable sous réserve des contrôles habituels." };
  }),
  zones: router({
    list: protectedProcedure.query(() => listMaritimeZones()),
    create: supervisorProcedure.input(z.object({ name: z.string().min(2), description: z.string().optional(), zoneType: z.enum(["exclusion", "forte_houle", "peche_interdite", "frontiere"]), polygon: z.array(z.tuple([z.number(), z.number()])).min(3) })).mutation(({ input, ctx }) => createMaritimeZone({ ...input, polygon: JSON.stringify(input.polygon), createdBy: ctx.user.id })),
  }),
  weather: router({
    list: protectedProcedure.input(z.object({ place: z.string().optional() }).optional()).query(({ input }) => listWeatherBulletins(input?.place)),
    create: supervisorProcedure.input(z.object({ place: z.string().min(2), windSpeed: z.number().nonnegative(), waveHeight: z.number().nonnegative(), severity: z.enum(["normal", "vigilance", "danger"]), message: z.string().min(3), validUntil: z.coerce.date() })).mutation(({ input, ctx }) => createWeatherBulletin({ ...input, waveHeight: String(input.waveHeight), createdBy: ctx.user.id })),
  }),
  positions: router({
    save: protectedProcedure.input(z.object({ vesselId: z.number().int().positive(), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), speed: z.number().nonnegative().default(0), heading: z.number().min(0).max(360).default(0), source: z.string().max(40).default("mobile") })).mutation(async ({ input }) => {
      const result = await saveVesselPosition({ ...input, latitude: String(input.latitude), longitude: String(input.longitude) });
      const zones = await listMaritimeZones();
      const breached = zones.filter((zone) => { try { return pointInPolygon([input.longitude, input.latitude], JSON.parse(zone.polygon)); } catch { return false; } });
      if (breached.length) await Promise.all(breached.map((zone) => createAlert({ title: `Entrée dans une zone ${zone.zoneType}`, description: zone.description ?? "Zone surveillée franchie.", place: zone.name, urgency: "urgent", source: "systeme", vesselId: input.vesselId })));
      return { ...result, breachedZones: breached.map((zone) => zone.name) };
    }),
  }),
  triage: supervisorProcedure.query(async () => {
    const alerts = await listAlerts();
    const priority = { detresse: 4, urgent: 3, elevee: 2, information: 1 } as Record<string, number>;
    return alerts.filter((alert) => alert.status !== "resolue").sort((a, b) => priority[b.urgency] - priority[a.urgency] || b.createdAt.getTime() - a.createdAt.getTime());
  }),
  admin: router({ health: adminProcedure.query(() => ({ database: true, predictive: true, geofencing: true })) }),
});
