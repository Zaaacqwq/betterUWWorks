import { matchTone, TONE_TEXT } from "@/lib/format";

interface MatchRingProps {
  score: number;
  size?: number;
}

export function MatchRing({ score, size = 32 }: MatchRingProps) {
  // Thicker and smaller-lettered as it grows, so a big ring stays a ring.
  const stroke = Math.max(3, Math.round(size * 0.085));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const center = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${TONE_TEXT[matchTone(score)]}`}
      role="img"
      aria-label={`${score}% match`}
      data-match-ring=""
    >
      <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--hairline-soft)" strokeWidth={stroke} />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text
        x="50%"
        y="50%"
        dy=".35em"
        textAnchor="middle"
        fill="currentColor"
        fontSize={size * (score >= 100 ? 0.3 : 0.34)}
        fontWeight={600}
      >
        {score}
      </text>
    </svg>
  );
}
