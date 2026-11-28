import React, { useEffect, useState } from "react";

const LOGO_ASSETS = {
  light: {
    static: "/assets/aistudio/cineglyph-logo-light_4fb07e1c.svg",
    animated: "/assets/aistudio/cineglyph-logo-light-animated_b44a4b39.svg",
  },
  dark: {
    static: "/assets/aistudio/cineglyph-logo-dark_f9194e38.svg",
    animated: "/assets/aistudio/cineglyph-logo-dark-animated_c6589b68.svg",
  },
} as const;

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return reduced;
}

interface CineglyphLogoProps {
  dark: boolean;
  animated?: boolean;
  className?: string;
  alt?: string;
  eager?: boolean;
}

export const CineglyphLogo: React.FC<CineglyphLogoProps> = ({
  dark,
  animated = false,
  className = "h-8 w-10",
  alt = "",
  eager = false,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const themeAssets = dark ? LOGO_ASSETS.dark : LOGO_ASSETS.light;
  const src = animated && !reducedMotion ? themeAssets.animated : themeAssets.static;

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      width={345}
      height={276}
      draggable={false}
      loading={eager ? "eager" : undefined}
      decoding="async"
      className={`aspect-[5/4] bg-transparent object-contain select-none ${className}`}
    />
  );
};
