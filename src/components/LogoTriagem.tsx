"use client";

import { useId } from "react";

/**
 * Logo interno simplificado: selo "J◆M" + palavra TRIAGEM com traço.
 * Usa as cores do tema (--ink, --accent, --accent2), então se adapta
 * sozinho ao modo azul, ao modo claro e à "Cor do sistema" escolhida.
 */
export default function LogoTriagem({
  className = "",
  somenteSelo = false,
}: {
  className?: string;
  somenteSelo?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const grad = `tri-grad-${id}`;

  if (somenteSelo) {
    return (
      <svg viewBox="0 0 70 70" className={className} role="img" aria-label="Triagem J.M">
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent2)" }} />
            <stop offset="1" style={{ stopColor: "var(--accent)" }} />
          </linearGradient>
        </defs>
        <rect x="4" y="7" width="62" height="56" rx="15" fill={`url(#${grad})`} />
        <Selo />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 284 72" className={className} role="img" aria-label="Triagem - Grupo J.Macedo">
      <defs>
        <linearGradient id={grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent2)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent)" }} />
        </linearGradient>
      </defs>
      <rect x="4" y="8" width="62" height="56" rx="15" fill={`url(#${grad})`} />
      <Selo />
      <text
        x="80"
        y="49"
        fontFamily="Inter, sans-serif"
        fontStyle="italic"
        fontWeight={900}
        fontSize="37"
        letterSpacing="0.5"
        style={{ fill: "var(--ink)" }}
      >
        TRIAGEM
      </text>
      <path d="M84 59 Q175 52 276 56" stroke={`url(#${grad})`} strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function Selo() {
  return (
    <>
      <text x="22" y="47" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={900} fontSize="24" fill="#fff">
        J
      </text>
      <rect x="31.5" y="37" width="7" height="7" rx="1" transform="rotate(45 35 40.5)" fill="#fff" />
      <text x="49" y="47" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight={900} fontSize="24" fill="#fff">
        M
      </text>
    </>
  );
}
