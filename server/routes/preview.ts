import { Router } from "express";
import { getFilmPreview } from "../services/filmPreviewService.ts";

export const previewRouter = Router();

function cleanQueryParam(raw: unknown, maxLen: number): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, maxLen);
}

previewRouter.get("/film/preview", async (req, res) => {
  const title = cleanQueryParam(req.query.title, 200);
  const itTitle = cleanQueryParam(req.query.itTitle, 200);
  const rawYear = cleanQueryParam(req.query.year, 10);
  const year = /^\d{4}$/.test(rawYear) ? rawYear : "";
  const director = cleanQueryParam(req.query.director, 150);
  const fast = req.query.fast === "1" || req.query.fast === "true";

  if (!title) {
    res.status(400).json({ error: "Titolo mancante." });
    return;
  }

  try {
    const clientId = req.ip || req.socket?.remoteAddress || "local";
    const result = await getFilmPreview({
      title,
      itTitle,
      year,
      director,
      fast,
      clientId,
    });
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json(result);
  } catch {
    res.json({ posterUrl: null, description: "", wikiUrl: null });
  }
});
