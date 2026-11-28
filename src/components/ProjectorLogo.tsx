import React from "react";

interface ProjectorLogoProps {
  className?: string;
}

export const ProjectorLogo: React.FC<ProjectorLogoProps> = ({
  className = "h-8 w-10",
}) => {
  return (
    <svg
      viewBox="0 0 56 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="projBeamGrad" x1="34" y1="22" x2="55" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#D97A46" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#D97A46" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Light projection beam */}
      <polygon
        points="35,20 55,13 55,31 35,24"
        fill="url(#projBeamGrad)"
        className="projector-beam-anim"
      />

      {/* Left film reel */}
      <g className="projector-reel-slow">
        <circle
          cx="12.5"
          cy="10.5"
          r="6.5"
          className="stroke-cg-text"
          strokeWidth="1.75"
        />
        <circle cx="12.5" cy="10.5" r="1.6" className="fill-cg-accent" />
        <line x1="12.5" y1="4.5" x2="12.5" y2="8.5" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="12.5" y1="12.5" x2="12.5" y2="16.5" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="6.5" y1="10.5" x2="10.5" y2="10.5" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="14.5" y1="10.5" x2="18.5" y2="10.5" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
      </g>

      {/* Right film reel */}
      <g className="projector-reel-fast">
        <circle
          cx="25"
          cy="11.5"
          r="5.5"
          className="stroke-cg-text"
          strokeWidth="1.75"
        />
        <circle cx="25" cy="11.5" r="1.4" className="fill-cg-accent" />
        <line x1="25" y1="6.3" x2="25" y2="9.7" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="25" y1="13.3" x2="25" y2="16.7" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="19.8" y1="11.5" x2="23.2" y2="11.5" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="26.8" y1="11.5" x2="30.2" y2="11.5" className="stroke-cg-secondary" strokeWidth="1.3" strokeLinecap="round" />
      </g>

      {/* Projector main body */}
      <rect
        x="7"
        y="16.5"
        width="23"
        height="13.5"
        rx="3"
        className="fill-cg-surface stroke-cg-text"
        strokeWidth="1.75"
      />

      {/* Lens housing */}
      <path
        d="M30 19.5L35.5 18V26L30 24.5V19.5Z"
        className="fill-cg-accent stroke-cg-accent"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />

      {/* Lens detail & body accent line */}
      <rect
        x="11"
        y="21"
        width="10"
        height="4.5"
        rx="1.2"
        className="fill-cg-elevated stroke-cg-border"
        strokeWidth="1"
      />

      {/* Tripod / stand legs */}
      <line x1="13.5" y1="30" x2="10.5" y2="34.5" className="stroke-cg-secondary" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="23.5" y1="30" x2="26.5" y2="34.5" className="stroke-cg-secondary" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};
