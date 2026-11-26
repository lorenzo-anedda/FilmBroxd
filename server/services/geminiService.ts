import { GoogleGenAI, ThinkingLevel } from "@google/genai";

export function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export function extractErrorDetails(err: unknown): { status: number; message: string } {
  const rawMsg = err instanceof Error ? err.message : String(err);
  let status =
    typeof (err as { status?: number })?.status === "number"
      ? (err as { status: number }).status
      : 500;
  let message = rawMsg;

  if (rawMsg.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(rawMsg) as { error?: { code?: number; message?: string } };
      if (parsed?.error?.message) {
        message = parsed.error.message;
      }
      if (typeof parsed?.error?.code === "number") {
        status = parsed.error.code;
      }
    } catch {
      // keep rawMsg
    }
  }

  return { status, message };
}

export function isOverloadedOrTransient(status: number, message: string): boolean {
  return (
    status === 503 ||
    status === 502 ||
    status === 504 ||
    status === 500 ||
    /UNAVAILABLE|high demand|overloaded|try again later|temporarily|ECONNRESET|ETIMEDOUT/i.test(
      message
    )
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GenerateOptions {
  prompt: string;
  jsonMode?: "array" | "object" | "text";
  fast?: boolean;
}

export async function generateWithRetries(
  ai: GoogleGenAI,
  { prompt, jsonMode = "text", fast = false }: GenerateOptions
): Promise<string> {
  const attempts: Array<{
    model: string;
    thinkingLevel?: ThinkingLevel;
    delayMs: number;
  }> = [
    {
      model: "gemini-4-hydrogen",
      thinkingLevel: fast ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
      delayMs: 0,
    },
    {
      model: "gemini-3.1-flash-lite",
      delayMs: 500,
    },
    {
      model: "gemini-4-hydrogen",
      thinkingLevel: ThinkingLevel.LOW,
      delayMs: 1200,
    },
    {
      model: "gemini-3.1-flash-lite",
      delayMs: 2000,
    },
  ];

  let lastErr: unknown = null;

  for (const attempt of attempts) {
    if (attempt.delayMs > 0) {
      const jitter = Math.floor(Math.random() * 250);
      await sleep(attempt.delayMs + jitter);
    }

    try {
      const config: {
        responseMimeType?: string;
        systemInstruction?: string;
        thinkingConfig?: { thinkingLevel: ThinkingLevel };
      } = {};

      if (jsonMode === "array") {
        config.responseMimeType = "application/json";
        config.systemInstruction =
          "Rispondi esclusivamente con un array JSON valido che inizia con [ e termina con ], senza markdown o testo aggiuntivo.";
      } else if (jsonMode === "object") {
        config.responseMimeType = "application/json";
        config.systemInstruction =
          "Rispondi esclusivamente con un oggetto JSON valido che inizia con { e termina con }, senza markdown o testo aggiuntivo.";
      }

      if (attempt.thinkingLevel) {
        config.thinkingConfig = { thinkingLevel: attempt.thinkingLevel };
      }

      const response = await ai.models.generateContent({
        model: attempt.model,
        contents: prompt,
        config,
      });

      const text = (response.text ?? "").trim();
      if (!text) {
        lastErr = new Error("Risposta vuota dal modello AI.");
        continue;
      }

      if (jsonMode === "array" || jsonMode === "object") {
        const stripped = text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        if (!stripped.includes("{") && !stripped.includes("[")) {
          lastErr = new Error("Risposta AI senza JSON valido.");
          continue;
        }
      }

      return text;
    } catch (err: unknown) {
      lastErr = err;
      const { status, message } = extractErrorDetails(err);

      if (
        status === 400 ||
        status === 401 ||
        status === 403 ||
        /API_KEY_INVALID|PERMISSION_DENIED/i.test(message)
      ) {
        break;
      }

      if (!isOverloadedOrTransient(status, message) && status !== 429) {
        break;
      }
    }
  }

  throw lastErr ?? new Error("Errore AI sconosciuto.");
}
