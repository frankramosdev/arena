/**
 * Personality Creator Types
 */

import { z } from "zod";

// =============================================================================
// PERSONALITY SCHEMA (matches trading/types)
// =============================================================================

export const RiskProfileSchema = z.enum(["conservative", "moderate", "aggressive", "degen"]);
export const TradingStyleSchema = z.enum(["value", "momentum", "contrarian", "arbitrage", "yolo"]);
export const CommunicationToneSchema = z.enum(["formal", "casual", "aggressive", "philosophical", "meme"]);
export const VerbositySchema = z.enum(["terse", "normal", "verbose"]);

export type RiskProfile = z.infer<typeof RiskProfileSchema>;
export type TradingStyle = z.infer<typeof TradingStyleSchema>;
export type CommunicationTone = z.infer<typeof CommunicationToneSchema>;
export type Verbosity = z.infer<typeof VerbositySchema>;

export const AgentPersonalitySchema = z.object({
  riskProfile: RiskProfileSchema,
  tradingStyle: TradingStyleSchema,
  maxPositionPercent: z.number().min(0.05).max(0.25),
  minConfidenceToTrade: z.number().min(0.50).max(0.90),
  tone: CommunicationToneSchema,
  verbosity: VerbositySchema,
  catchphrases: z.array(z.string()),
  expertise: z.array(z.string()),
  avoids: z.array(z.string()),
  bio: z.string(),
  tradingPhilosophy: z.string(),
});

export type AgentPersonality = z.infer<typeof AgentPersonalitySchema>;

// =============================================================================
// GENERATED AGENT
// =============================================================================

export const GeneratedAgentSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatar: z.string().optional(),
  twitterId: z.string().optional(),
  generatedAt: z.string(),
  personality: AgentPersonalitySchema,
});

export type GeneratedAgent = z.infer<typeof GeneratedAgentSchema>;

// =============================================================================
// CONFIG
// =============================================================================

export interface CreatorConfig {
  model: string;
  maxResearchSteps: number;
  timeoutMs: number;
  outputDir: string;
}

export const DEFAULT_CONFIG: CreatorConfig = {
  model: "grok-4-1-fast-reasoning",
  maxResearchSteps: 50,
  timeoutMs: 300_000, // 5 minutes for deep research
  outputDir: "./agents",
};
