import { Router } from "express";
import {
  generateWithRetries,
  getAIClient,
  toSafeClientAiError,
} from "../services/geminiService.ts";

export const aiRouter = Router();

aiRouter.get("/health", (_req, res) => {
  const aiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
  );
  res.json({ ok: true, aiConfigured });
});

const MAX_PROMPT_CHARS = 120_000;
const ALLOWED_JSON_MODES = new Set(["array", "object", "text"]);

aiRouter.post("/ai/generate", async (req, res) => {
  const ai = getAIClient();
  if (!ai) {
    res.status(503).json({
      code: "no_ai",
      error: "Servizio AI non configurato sul server.",
    });
    return;
  }

  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? (req.body as {
          prompt?: unknown;
          jsonMode?: unknown;
          fast?: unknown;
        })
      : null;

  if (!body || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    res.status(400).json({
      code: "bad_request",
      error: "Prompt mancante.",
    });
    return;
  }

  if (body.prompt.length > MAX_PROMPT_CHARS) {
    res.status(413).json({
      code: "payload_too_large",
      error: "Richiesta troppo lunga.",
    });
    return;
  }

  const jsonMode =
    typeof body.jsonMode === "string" && ALLOWED_JSON_MODES.has(body.jsonMode)
      ? (body.jsonMode as "array" | "object" | "text")
      : "text";

  const clientId = req.ip || req.socket?.remoteAddress || "local";

  try {
    const text = await generateWithRetries(ai, {
      prompt: body.prompt,
      jsonMode,
      fast: Boolean(body.fast),
      clientId,
    });
    res.json({ text });
  } catch (err: unknown) {
    const safeErr = toSafeClientAiError(err);
    if (safeErr.retryAfterSec) {
      res.setHeader("Retry-After", String(safeErr.retryAfterSec));
    }
    res.status(safeErr.status).json({
      code: safeErr.code,
      error: safeErr.error,
    });
  }
});
