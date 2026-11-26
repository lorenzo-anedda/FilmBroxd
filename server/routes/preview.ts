import { Router } from "express";
import { getFilmPreview } from "../services/filmPreviewService.ts";

export const previewRouter = Router();

previewRouter.get("/film/preview", async (req, res) => {
  const title = String(req.query.title || "").trim();
  const itTitle = String(req.query.itTitle || "").trim();
  const year = String(req.query.year || "").trim();
  const director = String(req.query.director || "").trim();

  if (!title) {
    res.status(400).json({ error: "Titolo mancante." });
    return;
  }

  try {
    const result = await getFilmPreview({ title, itTitle, year, director });
    res.json(result);
  } catch {
    res.json({ posterUrl: null, description: "", wikiUrl: null });
  }
});
