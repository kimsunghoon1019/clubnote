export function Sparkline({
  data,
  color = "var(--brand)",
  width = 92,
  height = 32,
  fill = false,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const coords = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 6) - 3;
    return { x, y };
  });
  const line = coords.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `0,${height} ${line} ${width},${height}`;
  const rising = data[data.length - 1] >= data[0];
  const stroke = color === "auto" ? (rising ? "var(--up)" : "var(--down)") : color;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      {fill ? <polyline points={area} fill={stroke} opacity={0.08} stroke="none" /> : null}
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
