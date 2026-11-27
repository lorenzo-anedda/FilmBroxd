import React, { useEffect, useId, useRef, useState } from "react";
import { Film } from "lucide-react";
import { extractDominantColor, getDominantColor } from "../utils/posterCache";

interface PosterImageProps {
  cacheKey: string;
  title: string;
  year?: string;
  posterUrl?: string | null;
  loading?: boolean;
  alt?: string;
  className?: string;
  imgClassName?: string;
  compactFallback?: boolean;
  rootMargin?: string;
  onVisible?: () => void;
}

export const PosterImage: React.FC<PosterImageProps> = ({
  cacheKey,
  title,
  year,
  posterUrl,
  loading = false,
  alt,
  className = "",
  imgClassName = "h-full w-full object-cover",
  compactFallback = false,
  rootMargin = "180px 0px",
  onVisible,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gradId = useId();
  const [inView, setInView] = useState<boolean>(false);
  const [imgLoaded, setImgLoaded] = useState<boolean>(false);
  const [imgError, setImgError] = useState<boolean>(false);
  const [dominantColor, setDominantColor] = useState<string>(() =>
    getDominantColor(cacheKey)
  );
  const visibleNotifiedRef = useRef<boolean>(false);
  const onVisibleRef = useRef(onVisible);
  onVisibleRef.current = onVisible;

  useEffect(() => {
    setDominantColor(getDominantColor(cacheKey));
    setImgLoaded(false);
    setImgError(false);
    visibleNotifiedRef.current = false;
  }, [cacheKey]);

  useEffect(() => {
    setImgLoaded(false);
    setImgError(false);
  }, [posterUrl]);

  // Lazy load trigger via IntersectionObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      if (!visibleNotifiedRef.current) {
        visibleNotifiedRef.current = true;
        onVisibleRef.current?.();
      }
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            if (!visibleNotifiedRef.current) {
              visibleNotifiedRef.current = true;
              onVisibleRef.current?.();
            }
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [cacheKey, rootMargin]);

  // Sample real dominant color once visible and poster URL is available
  useEffect(() => {
    if (!inView || !posterUrl) return;
    extractDominantColor(posterUrl, cacheKey, (hex) => {
      setDominantColor(hex);
    });
  }, [inView, posterUrl, cacheKey]);

  const effectiveUrl = inView && !imgError ? posterUrl : null;
  const showPlaceholderOverlay = !effectiveUrl || !imgLoaded;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
    >
      {/* Dominant color SVG backdrop (zero inline style attributes) */}
      <svg
        className={`pointer-events-none absolute inset-0 h-full w-full transition-opacity duration-300 ${
          loading || (effectiveUrl && !imgLoaded) ? "animate-pulse" : ""
        }`}
        viewBox="0 0 100 150"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={dominantColor} stopOpacity="0.92" />
            <stop offset="100%" stopColor="#090D16" stopOpacity="0.96" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="100" height="150" fill={`url(#${gradId})`} />
      </svg>

      {/* Fallback or loading caption over dominant color */}
      {showPlaceholderOverlay && (
        <div
          className={`relative z-10 flex h-full w-full flex-col items-center justify-between text-center text-white/90 ${
            compactFallback ? "p-2" : "p-3.5"
          }`}
        >
          <span className="font-mono text-[10px] uppercase tracking-wider text-white/75">
            {year || "Film"}
          </span>
          <Film
            className={`${
              compactFallback ? "h-5 w-5" : "h-7 w-7"
            } text-white/75`}
          />
          <span
            className={`font-display font-semibold leading-tight text-white/90 ${
              compactFallback
                ? "line-clamp-2 text-[10px]"
                : "line-clamp-3 text-xs"
            }`}
          >
            {loading || (effectiveUrl && !imgLoaded) ? "Carico…" : title}
          </span>
        </div>
      )}

      {/* Actual poster image loaded lazily on intersection */}
      {effectiveUrl && (
        <img
          src={effectiveUrl}
          alt={alt ?? `Locandina di ${title}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 z-20 transition-opacity duration-300 ${
            imgLoaded ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </div>
  );
};
