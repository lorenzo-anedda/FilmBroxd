import { Router } from "express";
import {
  extractErrorDetails,
  generateWithRetries,
  getAIClient,
  isOverloadedOrTransient,
} from "../services/geminiService.ts";

export const aiRouter = Router();

aiRouter.get("/health", (_req, res) => {
  const aiConfigured = Boolean(
    process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY"
  );
  res.json({ ok: true, aiConfigured });
});

aiRouter.post("/ai/generate", async (req, res) => {
  const ai = getAIClient();
  if (!ai) {
    res.status(503).json({
      code: "no_ai",
      error: "Servizio AI non configurato sul server.",
    });
    return;
  }

  const { prompt, jsonMode, fast } = req.body as {
    prompt?: string;
    jsonMode?: "array" | "object" | "text";
    fast?: boolean;
  };

  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({
      code: "bad_request",
      error: "Prompt mancante.",
    });
    return;
  }

  try {
    const text = await generateWithRetries(ai, {
      prompt,
      jsonMode,
      fast: Boolean(fast),
    });
    res.json({ text });
  } catch (err: unknown) {
    const { status, message } = extractErrorDetails(err);

    if (status === 429 || /RESOURCE_EXHAUSTED|quota|rate/i.test(message)) {
      res.status(429).json({
        code: "rate_limited",
        error: "Limite richieste AI raggiunto, riprova tra poco.",
      });
      return;
    }

    if (
      status === 400 ||
      status === 401 ||
      status === 403 ||
      /API_KEY_INVALID|PERMISSION_DENIED/i.test(message)
    ) {
      res.status(status).json({
        code: "auth_error",
        error: "Errore di autenticazione API Gemini: verifica Settings > Secrets.",
      });
      return;
    }

    if (isOverloadedOrTransient(status, message)) {
      res.status(503).json({
        code: "overloaded",
        error:
          "Modello AI momentaneamente sovraccarico per traffico elevato. Riprova tra qualche secondo.",
      });
      return;
    }

    res.status(500).json({
      code: "ai_error",
      error: message.slice(0, 200),
    });
  }
});
