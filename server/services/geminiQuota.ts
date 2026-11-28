import fs from "fs";
import os from "os";
import path from "path";
import {
  GEMINI_MODELS,
  GEMINI_TIMEZONE,
  getGeminiRuntimeConfig,
  type GeminiModelId,
  type GeminiRuntimeConfig,
} from "../config/geminiConfig.ts";

export type QuotaRejectionReason =
  | "concurrency_limit"
  | "model_concurrency_limit"
  | "client_rpm_limit"
  | "model_rpm_limit"
  | "daily_budget_exhausted";

export class QuotaExhaustedError extends Error {
  readonly status = 429;
  readonly code = "rate_limited";
  readonly reason: QuotaRejectionReason;
  readonly model: GeminiModelId;
  readonly retryAfterSec: number;

  constructor(params: {
    reason: QuotaRejectionReason;
    model: GeminiModelId;
    retryAfterSec: number;
    message: string;
  }) {
    super(params.message);
    this.name = "QuotaExhaustedError";
    this.reason = params.reason;
    this.model = params.model;
    this.retryAfterSec = Math.max(1, Math.ceil(params.retryAfterSec));
  }
}

export interface GeminiMetricsSnapshot {
  dayKey: string;
  requestsByModel: Record<GeminiModelId, number>;
  dailyUsageByModel: Record<GeminiModelId, number>;
  cacheHits: number;
  deduplicatedRequests: number;
  retries: number;
  errors429: number;
  errors503: number;
  budgetBlocked: number;
  localFallbacks: number;
  activeTotal: number;
  activeByModel: Record<GeminiModelId, number>;
}

interface PersistedQuotaState {
  dayKey: string;
  dailyCounts: Record<GeminiModelId, number>;
}

const DEFAULT_QUOTA_FILE = path.join(os.tmpdir(), "cineglyph-gemini-quota.json");
const MAX_CLIENT_BUCKETS = 1000;

const laDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: GEMINI_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function getLosAngelesDateKey(nowMs = Date.now()): string {
  return laDateFormatter.format(new Date(nowMs));
}

function emptyModelCounts(): Record<GeminiModelId, number> {
  return {
    [GEMINI_MODELS.HYDROGEN]: 0,
    [GEMINI_MODELS.FLASH_LITE]: 0,
  };
}

function getQuotaFilePath(): string {
  return process.env.GEMINI_QUOTA_FILE?.trim() || DEFAULT_QUOTA_FILE;
}

function sanitizeClientId(raw?: string): string {
  if (!raw || typeof raw !== "string") return "local";
  return raw.trim().slice(0, 64) || "local";
}

class GeminiQuotaManager {
  private dayKey: string = getLosAngelesDateKey();
  private dailyCounts: Record<GeminiModelId, number> = emptyModelCounts();
  private modelRpmWindows: Record<GeminiModelId, number[]> = {
    [GEMINI_MODELS.HYDROGEN]: [],
    [GEMINI_MODELS.FLASH_LITE]: [],
  };
  private clientRpmWindows = new Map<string, number[]>();
  private activeTotal = 0;
  private activeByModel: Record<GeminiModelId, number> = emptyModelCounts();

  private metrics = {
    requestsByModel: emptyModelCounts(),
    cacheHits: 0,
    deduplicatedRequests: 0,
    retries: 0,
    errors429: 0,
    errors503: 0,
    budgetBlocked: 0,
    localFallbacks: 0,
  };

  private persistenceEnabled = true;

  constructor() {
    this.loadPersistedDailyState(Date.now());
  }

  private loadPersistedDailyState(nowMs: number): void {
    if (!this.persistenceEnabled) return;
    const currentDay = getLosAngelesDateKey(nowMs);
    this.dayKey = currentDay;
    try {
      const filePath = getQuotaFilePath();
      if (!fs.existsSync(filePath)) return;
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistedQuotaState>;
      if (parsed && parsed.dayKey === currentDay && parsed.dailyCounts) {
        const h = Number(parsed.dailyCounts[GEMINI_MODELS.HYDROGEN]);
        const f = Number(parsed.dailyCounts[GEMINI_MODELS.FLASH_LITE]);
        this.dailyCounts[GEMINI_MODELS.HYDROGEN] =
          Number.isFinite(h) && h >= 0 ? Math.floor(h) : 0;
        this.dailyCounts[GEMINI_MODELS.FLASH_LITE] =
          Number.isFinite(f) && f >= 0 ? Math.floor(f) : 0;
      }
    } catch {
      // Ephemeral or restricted filesystem: fall back cleanly to in-memory counters
    }
  }

  private persistDailyState(): void {
    if (!this.persistenceEnabled) return;
    const payload: PersistedQuotaState = {
      dayKey: this.dayKey,
      dailyCounts: { ...this.dailyCounts },
    };
    try {
      const filePath = getQuotaFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${filePath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
      fs.renameSync(tmpPath, filePath);
    } catch {
      // Ignore write errors on read-only/ephemeral filesystems
    }
  }

  private syncDayRollover(nowMs: number): void {
    const currentDay = getLosAngelesDateKey(nowMs);
    if (currentDay !== this.dayKey) {
      this.dayKey = currentDay;
      this.dailyCounts = emptyModelCounts();
      this.persistDailyState();
    }
  }

  private pruneWindow(timestamps: number[], cutoffMs: number): number[] {
    let idx = 0;
    while (idx < timestamps.length && timestamps[idx] <= cutoffMs) {
      idx++;
    }
    return idx > 0 ? timestamps.slice(idx) : timestamps;
  }

  private pruneClientMap(cutoffMs: number): void {
    if (this.clientRpmWindows.size < MAX_CLIENT_BUCKETS) return;
    for (const [k, ts] of this.clientRpmWindows.entries()) {
      const pruned = this.pruneWindow(ts, cutoffMs);
      if (pruned.length === 0) {
        this.clientRpmWindows.delete(k);
      } else {
        this.clientRpmWindows.set(k, pruned);
      }
    }
  }

  private secondsUntilNextLosAngelesMidnight(nowMs: number): number {
    // Upper bound fallback: at most 24h; compute approximate seconds via LA hour/minute
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: GEMINI_TIMEZONE,
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).formatToParts(new Date(nowMs));
      const h = Number(parts.find((p) => p.type === "hour")?.value || 0) % 24;
      const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
      const s = Number(parts.find((p) => p.type === "second")?.value || 0);
      const elapsedSec = h * 3600 + m * 60 + s;
      return Math.max(60, 86400 - elapsedSec);
    } catch {
      return 3600;
    }
  }

  /**
   * Synchronously checks and reserves all quota/concurrency limits before a Gemini call.
   * No async gap occurs between check and reservation, preventing race conditions.
   */
  reserveSlot(params: {
    model: GeminiModelId;
    clientId?: string;
    nowMs?: number;
    configOverride?: GeminiRuntimeConfig;
  }): { release: () => void } {
    const nowMs = params.nowMs ?? Date.now();
    const config = params.configOverride ?? getGeminiRuntimeConfig();
    const model = params.model;
    const modelLimits = config.models[model];
    const clientKey = sanitizeClientId(params.clientId);
    const cutoffMs = nowMs - 60_000;

    this.syncDayRollover(nowMs);

    if (this.activeTotal >= config.maxConcurrentGlobal) {
      this.metrics.budgetBlocked += 1;
      this.metrics.errors429 += 1;
      throw new QuotaExhaustedError({
        reason: "concurrency_limit",
        model,
        retryAfterSec: 2,
        message: "Troppe richieste AI simultanee: riprova tra qualche secondo.",
      });
    }

    if (this.activeByModel[model] >= modelLimits.maxConcurrent) {
      this.metrics.budgetBlocked += 1;
      this.metrics.errors429 += 1;
      throw new QuotaExhaustedError({
        reason: "model_concurrency_limit",
        model,
        retryAfterSec: 2,
        message: "Limite di richieste AI simultanee raggiunto: riprova tra poco.",
      });
    }

    this.pruneClientMap(cutoffMs);
    const clientTs = this.pruneWindow(
      this.clientRpmWindows.get(clientKey) || [],
      cutoffMs
    );
    this.clientRpmWindows.set(clientKey, clientTs);

    if (clientTs.length >= config.clientRpmLimit) {
      const oldest = clientTs[0] ?? nowMs;
      const waitSec = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
      this.metrics.budgetBlocked += 1;
      this.metrics.errors429 += 1;
      throw new QuotaExhaustedError({
        reason: "client_rpm_limit",
        model,
        retryAfterSec: waitSec,
        message: "Limite richieste per client raggiunto, riprova tra poco.",
      });
    }

    if (this.dailyCounts[model] >= modelLimits.rpd) {
      this.metrics.budgetBlocked += 1;
      this.metrics.errors429 += 1;
      throw new QuotaExhaustedError({
        reason: "daily_budget_exhausted",
        model,
        retryAfterSec: this.secondsUntilNextLosAngelesMidnight(nowMs),
        message: "Budget giornaliero AI raggiunto per oggi, riprova domani.",
      });
    }

    const modelTs = this.pruneWindow(this.modelRpmWindows[model], cutoffMs);
    this.modelRpmWindows[model] = modelTs;
    if (modelTs.length >= modelLimits.rpm) {
      const oldest = modelTs[0] ?? nowMs;
      const waitSec = Math.max(1, Math.ceil((oldest + 60_000 - nowMs) / 1000));
      this.metrics.budgetBlocked += 1;
      this.metrics.errors429 += 1;
      throw new QuotaExhaustedError({
        reason: "model_rpm_limit",
        model,
        retryAfterSec: waitSec,
        message: "Limite richieste al minuto raggiunto, riprova tra poco.",
      });
    }

    // Atomic synchronous reservation
    this.activeTotal += 1;
    this.activeByModel[model] += 1;
    modelTs.push(nowMs);
    clientTs.push(nowMs);
    this.dailyCounts[model] += 1;
    this.metrics.requestsByModel[model] += 1;
    this.persistDailyState();

    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        this.activeTotal = Math.max(0, this.activeTotal - 1);
        this.activeByModel[model] = Math.max(0, this.activeByModel[model] - 1);
      },
    };
  }

  recordCacheHit(): void {
    this.metrics.cacheHits += 1;
  }

  recordDeduplicatedRequest(): void {
    this.metrics.deduplicatedRequests += 1;
  }

  recordRetry(): void {
    this.metrics.retries += 1;
  }

  recordUpstreamError(status: number): void {
    if (status === 429) this.metrics.errors429 += 1;
    else if (status === 503) this.metrics.errors503 += 1;
  }

  recordLocalFallback(): void {
    this.metrics.localFallbacks += 1;
  }

  getMetrics(nowMs = Date.now()): GeminiMetricsSnapshot {
    this.syncDayRollover(nowMs);
    return {
      dayKey: this.dayKey,
      requestsByModel: { ...this.metrics.requestsByModel },
      dailyUsageByModel: { ...this.dailyCounts },
      cacheHits: this.metrics.cacheHits,
      deduplicatedRequests: this.metrics.deduplicatedRequests,
      retries: this.metrics.retries,
      errors429: this.metrics.errors429,
      errors503: this.metrics.errors503,
      budgetBlocked: this.metrics.budgetBlocked,
      localFallbacks: this.metrics.localFallbacks,
      activeTotal: this.activeTotal,
      activeByModel: { ...this.activeByModel },
    };
  }

  resetForTests(options?: {
    nowMs?: number;
    disablePersistence?: boolean;
    reloadPersistence?: boolean;
  }): void {
    const nowMs = options?.nowMs ?? Date.now();
    if (options?.disablePersistence !== undefined) {
      this.persistenceEnabled = !options.disablePersistence;
    }
    this.dayKey = getLosAngelesDateKey(nowMs);
    this.dailyCounts = emptyModelCounts();
    this.modelRpmWindows = {
      [GEMINI_MODELS.HYDROGEN]: [],
      [GEMINI_MODELS.FLASH_LITE]: [],
    };
    this.clientRpmWindows.clear();
    this.activeTotal = 0;
    this.activeByModel = emptyModelCounts();
    this.metrics = {
      requestsByModel: emptyModelCounts(),
      cacheHits: 0,
      deduplicatedRequests: 0,
      retries: 0,
      errors429: 0,
      errors503: 0,
      budgetBlocked: 0,
      localFallbacks: 0,
    };
    if (options?.reloadPersistence) {
      this.loadPersistedDailyState(nowMs);
    }
  }
}

export const geminiQuota = new GeminiQuotaManager();
