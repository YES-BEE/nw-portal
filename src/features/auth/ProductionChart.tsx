const points = [
  [14, 144],
  [69, 130],
  [124, 140],
  [179, 110],
  [234, 82],
  [289, 112],
  [344, 65],
  [399, 90],
  [454, 48],
  [509, 23],
];

export function ProductionChart() {
  return (
    <div className="auth-chart" aria-hidden="true">
      <svg viewBox="0 0 530 180" preserveAspectRatio="none">
        <defs>
          <linearGradient id="production-bar" x1="0" x2="0" y1="0" y2="1">
            <stop stopColor="#236fff" stopOpacity=".75" />
            <stop offset="1" stopColor="#236fff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g fill="url(#production-bar)">
          {points.map(([x, y]) => (
            <rect key={x} x={x - 4} y={y} width="9" height={180 - y} />
          ))}
        </g>
        <polyline
          points={points.map((point) => point.join(',')).join(' ')}
          stroke="#83aaf4"
          strokeWidth="2"
          fill="none"
        />
        <g fill="#8db4ff">
          {points.map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="5" />
          ))}
        </g>
      </svg>
    </div>
  );
}
