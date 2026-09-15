import { matchTone, TONE_TEXT } from "@/lib/format";

interface MatchRingProps {
  score: number;
  size?: number;
  // Not yet checked line by line: shown as ~score, on a dashed track.
  estimate?: boolean;
}

export function MatchRing({ score, size = 32, estimate = false }: MatchRingProps) {
  // Thicker and smaller-lettered as it grows, so a big ring stays a ring.
  const stroke = Math.max(3, Math.round(size * 0.085));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const center = size / 2;
  const fontSize = size * (score >= 100 ? 0.3 : 0.34);
  // Drops the digits' baseline so they sit in the middle of the ring.
  const drop = fontSize * 0.35;
  // The ~ is smaller than the digits, so it is raised to their middle.
  const lift = size * 0.03;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${TONE_TEXT[matchTone(score)]}`}
      role="img"
      aria-label={estimate ? `About ${score}% match, estimated` : `${score}% match`}
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
        opacity={estimate ? 0.55 : 1}
      />
      <text x="50%" y="50%" textAnchor="middle" fill="currentColor" fontSize={fontSize} fontWeight={600}>
        {estimate ? (
          // dy on a tspan moves every character after it too, so the number
          // takes back the ~'s lift and keeps the same baseline as a checked one.
          <>
            <tspan fontSize={size * 0.24} fontWeight={500} dy={drop - lift}>
              ~
            </tspan>
            <tspan dy={lift}>{score}</tspan>
          </>
        ) : (
          <tspan dy={drop}>{score}</tspan>
        )}
      </text>
    </svg>
  );
}
