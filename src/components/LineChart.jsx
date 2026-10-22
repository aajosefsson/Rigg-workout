import { round1, shortDate } from "../lib/progress";

export function LineChart({ points, unit }) {
  const W = 640,
    H = 230,
    padL = 46,
    padR = 18,
    padT = 18,
    padB = 36;
  const vals = points.map((p) => p.value);
  let lo = Math.min(...vals),
    hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const margin = (hi - lo) * 0.15;
  lo = Math.max(0, lo - margin);
  hi += margin;
  const n = points.length;
  const x = (i) =>
    n === 1 ? (padL + (W - padR)) / 2 : padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const ticks = [0, 1, 2, 3].map((t) => lo + ((hi - lo) * t) / 3);
  const every = Math.ceil(n / 6);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={`Progress chart in ${unit}`}
    >
      {ticks.map((t, i) => (
        <g key={i}>
          <line
            x1={padL}
            x2={W - padR}
            y1={y(t)}
            y2={y(t)}
            stroke="rgba(255,255,255,0.08)"
          />
          <text
            x={padL - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize="11"
            fill="#8a7a6a"
          >
            {round1(t)}
          </text>
        </g>
      ))}
      {n > 1 && (
        <polyline
          fill="none"
          stroke="#FF6B1A"
          strokeWidth="2.5"
          strokeLinejoin="round"
          points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
        />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <circle
            cx={x(i)}
            cy={y(p.value)}
            r="4.5"
            fill="#FF6B1A"
            stroke="#1a0f07"
            strokeWidth="2"
          >
            <title>{`${shortDate(p.date)}: ${p.value} ${unit}`}</title>
          </circle>
          {(i === 0 || i === n - 1 || n <= 8) && (
            <text
              x={x(i)}
              y={y(p.value) - 10}
              textAnchor="middle"
              fontSize="11"
              fill="#f0ebe3"
            >
              {p.value}
            </text>
          )}
          {(i % every === 0 || i === n - 1) && (
            <text
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              fontSize="11"
              fill="#8a7a6a"
            >
              {shortDate(p.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
