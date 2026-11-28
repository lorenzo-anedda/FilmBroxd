export const GEMINI_MODELS = {
  FLASH_LITE: "gemini-3.1-flash-lite",
  HYDROGEN: "gemini-4-hydrogen",
} as const;

export type GeminiModelId = (typeof GEMINI_MODELS)[keyof typeof GEMINI_MODELS];

export const GEMINI_TIMEZONE = "America/Los_Angeles";

export const MAX_GEMINI_ATTEMPTS = 2;
export const MAX_RETRY_WAIT_MS = 3500;
export const BASE_RETRY_DELAY_MS = 600;

export const AI_CACHE_TTL_MS = 5 * 60 * 1000;
export const AI_CACHE_MAX_ENTRIES = 100;

export interface ModelQuotaLimits {
  rpm: number;
  rpd: number;
  maxConcurrent: number;
}

export interface GeminiRuntimeConfig {
  models: Record<GeminiModelId, ModelQuotaLimits>;
  maxConcurrentGlobal: number;
  clientRpmLimit: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function getGeminiRuntimeConfig(): GeminiRuntimeConfig {
  return {
    models: {
      [GEMINI_MODELS.HYDROGEN]: {
        rpm: parsePositiveInt(process.env.GEMINI_HYDROGEN_RPM, 3),
        rpd: parsePositiveInt(process.env.GEMINI_HYDROGEN_RPD, 15),
        maxConcurrent: parsePositiveInt(process.env.GEMINI_HYDROGEN_CONCURRENT, 2),
      },
      [GEMINI_MODELS.FLASH_LITE]: {
        rpm: parsePositiveInt(process.env.GEMINI_FLASH_LITE_RPM, 12),
        rpd: parsePositiveInt(process.env.GEMINI_FLASH_LITE_RPD, 400),
        maxConcurrent: parsePositiveInt(process.env.GEMINI_FLASH_LITE_CONCURRENT, 4),
      },
    },
    maxConcurrentGlobal: parsePositiveInt(process.env.GEMINI_MAX_CONCURRENT, 4),
    clientRpmLimit: parsePositiveInt(process.env.GEMINI_CLIENT_RPM, 20),
  };
}

export function isValidGeminiModel(model: unknown): model is GeminiModelId {
  return (
    model === GEMINI_MODELS.FLASH_LITE || model === GEMINI_MODELS.HYDROGEN
  );
}

/**
 * Selects the model for an operation:
 * - `fast = true` (metadata, classification, fast structured JSON, preview synopses) -> Flash Lite
 * - `fast = false` (recommendations, deep analysis) -> Hydrogen
 * Never escalates simple `fast` operations to Hydrogen.
 */
export function selectGeminiModel(options: {
  fast?: boolean;
  preferredModel?: GeminiModelId;
}): GeminiModelId {
  if (options.fast) {
    return GEMINI_MODELS.FLASH_LITE;
  }
  if (options.preferredModel && isValidGeminiModel(options.preferredModel)) {
    return options.preferredModel;
  }
  return GEMINI_MODELS.HYDROGEN;
}
