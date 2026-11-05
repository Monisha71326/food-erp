import { useId } from "react";

/* Small line + bar sparkline used inside KPI cards */
export default function Sparkline({ data, color, width = 90, height = 38 }) {
  const gid = useId();
  const max = Math.max(...data);
  const min = Math.min(...data);
  const pad = 3;
  const lineCount = Math.ceil(data.length * 0.55);
  const step = (width - pad * 2) / (data.length - 1);
  const y = (v) => height - pad - ((v - min) / (max - min || 1)) * (height - pad * 2);

  const linePts = data.slice(0, lineCount).map((v, i) => [pad + i * step, y(v)]);
  const bars = data.slice(lineCount - 1).map((v, i) => ({ x: pad + (lineCount - 1 + i) * step, y: y(v) }));

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor={color} stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <polyline
        points={linePts.map((p) => p.join(",")).join(" ")}
        fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      {bars.map((b, i) => (
        <rect key={i} x={b.x - 2.5} y={b.y} width="5" height={height - pad - b.y} rx="1.5" fill={`url(#${gid})`} />
      ))}
    </svg>
  );
}
