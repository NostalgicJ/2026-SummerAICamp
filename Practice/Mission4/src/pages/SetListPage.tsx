import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchVisibleWordSets, type VisibleWordSet } from "../lib/wordsets";
import { loadProgress } from "../lib/storage";
import { buildQueue } from "../lib/queue";

export default function SetListPage() {
  const [sets, setSets] = useState<VisibleWordSet[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchVisibleWordSets()
      .then(setSets)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="page">
      <header className="page-header">
        <h1>단어 세트</h1>
        <Link to="/settings" className="btn-secondary">
          설정
        </Link>
      </header>

      {error && <p className="error">{error}</p>}
      {!sets && !error && <p>불러오는 중...</p>}

      {sets && sets.length === 0 && (
        <p className="empty-state">등록된 단어 세트가 없습니다. 설정에서 추가해보세요.</p>
      )}

      <div className="set-grid">
        {sets?.map(({ set }) => {
          const dueCount = buildQueue(set.cards, loadProgress(set.id)).length;
          return (
            <Link key={set.id} to={`/study/${set.id}`} className="set-card">
              <h2>{set.name}</h2>
              <p>{set.description}</p>
              <span className="set-meta">
                {set.cards.length}개 카드 · {set.language.front} → {set.language.back}
              </span>
              <span className="set-due-badge">오늘 복습 {dueCount}개</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
