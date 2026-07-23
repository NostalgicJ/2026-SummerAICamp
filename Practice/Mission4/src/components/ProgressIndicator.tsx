interface ProgressIndicatorProps {
  current: number;
  total: number;
}

export default function ProgressIndicator({ current, total }: ProgressIndicatorProps) {
  const pct = total === 0 ? 0 : (current / total) * 100;
  return (
    <div className="progress-indicator">
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">
        {current} / {total}
      </span>
    </div>
  );
}
