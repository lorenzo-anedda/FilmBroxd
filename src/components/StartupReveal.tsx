import React, { useEffect, useState } from "react";
import { CineglyphLogo, usePrefersReducedMotion } from "./CineglyphLogo";

interface StartupRevealProps {
  dark: boolean;
}

export const StartupReveal: React.FC<StartupRevealProps> = ({ dark }) => {
  const reducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState<"visible" | "fading" | "done">(() => {
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return "done";
    }
    return "visible";
  });

  useEffect(() => {
    if (reducedMotion || phase === "done") {
      if (reducedMotion && phase !== "done") setPhase("done");
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setPhase((curr) => (curr === "visible" ? "fading" : curr));
    }, 1350);

    const dismissNow = () => {
      setPhase((curr) => (curr === "visible" ? "fading" : curr));
    };

    window.addEventListener("pointerdown", dismissNow, { passive: true, once: true });
    window.addEventListener("keydown", dismissNow, { passive: true, once: true });
    window.addEventListener("wheel", dismissNow, { passive: true, once: true });

    return () => {
      window.clearTimeout(fadeTimer);
      window.removeEventListener("pointerdown", dismissNow);
      window.removeEventListener("keydown", dismissNow);
      window.removeEventListener("wheel", dismissNow);
    };
  }, [reducedMotion, phase]);

  useEffect(() => {
    if (phase !== "fading") return;
    const doneTimer = window.setTimeout(() => {
      setPhase("done");
    }, 500);
    return () => window.clearTimeout(doneTimer);
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center bg-cg-bg/92 backdrop-blur-[2px] transition-opacity duration-500 ease-out ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center gap-4 px-6 text-center">
        <CineglyphLogo
          dark={dark}
          animated
          eager
          className="h-24 w-[120px] sm:h-28 sm:w-[140px]"
        />
        <div className="space-y-1">
          <div className="font-display text-2xl font-bold tracking-tight text-cg-text">
            Cineglyph
          </div>
          <p className="text-sm text-cg-muted">Less scrolling. More cinema.</p>
        </div>
      </div>
    </div>
  );
};
