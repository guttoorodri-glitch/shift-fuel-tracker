type Props = {
  name: string;
  index: number;
  color: string;
  pct: number;
  levelLabel: string;
  soldLabel: string;
};

/** Desenho de um tanque de combustível preenchido conforme a porcentagem. */
export function TankGauge({ name, index, color, pct, levelLabel, soldLabel }: Props) {
  const clamped = Math.max(0, Math.min(100, pct));
  const fillHeight = (clamped / 100) * 92;

  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-background p-2">
      <svg viewBox="0 0 80 110" className="h-32 w-full" role="img" aria-label={`Tanque ${name}`}>
        <rect
          x="6"
          y="6"
          width="68"
          height="98"
          rx="18"
          fill="var(--muted)"
          stroke="var(--border)"
          strokeWidth="2"
        />
        <clipPath id={`clip-${index}`}>
          <rect x="8" y="8" width="64" height="94" rx="16" />
        </clipPath>
        <g clipPath={`url(#clip-${index})`}>
          <rect
            x="8"
            y={102 - fillHeight}
            width="64"
            height={fillHeight}
            fill={color}
            opacity="0.9"
          />
        </g>
        {[25, 50, 75].map((m) => (
          <line
            key={m}
            x1="58"
            x2="70"
            y1={102 - (m / 100) * 92}
            y2={102 - (m / 100) * 92}
            stroke="var(--border)"
            strokeWidth="1.5"
          />
        ))}
        <text
          x="40"
          y="60"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill="var(--foreground)"
        >
          {Math.round(clamped)}%
        </text>
      </svg>
      <p className="mt-1 text-center text-[11px] leading-tight text-foreground">
        {index + 1}. {name}
      </p>
      <p className="text-center text-[10px] tabular-nums leading-tight text-muted-foreground">
        {levelLabel}
      </p>
      <p className="text-center text-[10px] tabular-nums leading-tight text-muted-foreground">
        vendido {soldLabel}
      </p>
    </div>
  );
}
