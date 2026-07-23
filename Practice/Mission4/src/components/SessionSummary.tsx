import { Link } from "react-router-dom";
import type { SessionStats } from "../types";
import "./SessionSummary.css";

interface SessionSummaryProps {
  stats: SessionStats;
}

export default function SessionSummary({ stats }: SessionSummaryProps) {
  const total = stats.again + stats.hard + stats.good + stats.easy;
  const accuracy = total === 0 ? 0 : Math.round(((stats.good + stats.easy) / total) * 100);

  return (
    <div className="session-summary">
      <h2>오늘 학습 완료! 🎉</h2>
      <p className="session-summary-total">{total}개 카드 학습 · 정답률 {accuracy}%</p>

      <div className="session-summary-grid">
        <div className="session-summary-item">
          <span className="dot dot-again" />
          Again <strong>{stats.again}</strong>
        </div>
        <div className="session-summary-item">
          <span className="dot dot-hard" />
          Hard <strong>{stats.hard}</strong>
        </div>
        <div className="session-summary-item">
          <span className="dot dot-good" />
          Good <strong>{stats.good}</strong>
        </div>
        <div className="session-summary-item">
          <span className="dot dot-easy" />
          Easy <strong>{stats.easy}</strong>
        </div>
      </div>

      <Link to="/" className="btn-primary session-summary-link">
        목록으로
      </Link>
    </div>
  );
}
