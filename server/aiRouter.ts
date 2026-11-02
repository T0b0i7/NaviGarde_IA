import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { analyzeDashboard, analyzeInspection, analyzeVoiceAlert, generateInspectionReport } from "./_core/baseten";

const analysisSchema = z.object({
  passengersDetected: z.number().int().min(0).max(10000),
  lifejacketsVisible: z.number().int().min(0).max(10000),
  capacityRisk: z.enum(["faible", "moyen", "élevé", "critique", "à vérifier"]),
  riskScore: z.number().int().min(0).max(100),
  confidence: z.number().int().min(0).max(100),
  hull: z.enum(["bon", "à vérifier", "endommagé", "non visible"]),
  engine: z.enum(["bon", "à vérifier", "endommagé", "non visible"]),
  findings: z.array(z.string().min(1).max(500)).max(50),
  recommendation: z.string().min(1).max(2000),
  uncertainty: z.array(z.string().min(1).max(500)).max(50),
});

export const aiRouter = router({
  analyzeInspection: protectedProcedure.input(z.object({
    boat: z.string().min(1), type: z.string().min(1), capacity: z.number().nonnegative(), place: z.string().min(1), images: z.array(z.string().min(1)).min(1).max(5),
  })).mutation(({ input }) => analyzeInspection(input)),
  generateReport: protectedProcedure.input(z.object({
    boat: z.string().min(1), type: z.string().min(1), capacity: z.number().nonnegative(), place: z.string().min(1), agent: z.string().min(1), analysis: analysisSchema,
  })).mutation(({ input }) => generateInspectionReport(input)),
  analyzeVoiceAlert: protectedProcedure.input(z.object({ audioDataUrl: z.string().min(1).max(35_000_000).regex(/^data:audio\/(webm|wav|mp3|ogg|mpeg);base64,/) })).mutation(({ input }) => analyzeVoiceAlert(input.audioDataUrl)),
  analyzeDashboard: protectedProcedure.input(z.object({ period: z.string(), activity: z.unknown(), risks: z.unknown(), problems: z.unknown(), delays: z.unknown(), teamScore: z.number() })).mutation(({ input }) => analyzeDashboard(input)),
});
