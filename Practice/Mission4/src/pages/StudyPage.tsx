import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getWordSetById } from "../lib/wordsets";
import { ensureProgress, recordReview } from "../lib/storage";
import { buildQueue } from "../lib/queue";
import type { Card, Grade, SessionStats, SetProgress, WordSet } from "../types";
import Flashcard from "../components/Flashcard";
import ProgressIndicator from "../components/ProgressIndicator";
import GradeButtons from "../components/GradeButtons";
import SessionSummary from "../components/SessionSummary";

const STATE_LABEL: Record<string, string> = {
  new: "신규",
  learning: "학습중",
  review: "복습",
};

const EMPTY_SESSION_STATS: SessionStats = { again: 0, hard: 0, good: 0, easy: 0 };

export default function StudyPage() {
  const { setId } = useParams<{ setId: string }>();
  const [wordSet, setWordSet] = useState<WordSet | null>(null);
  const [queue, setQueue] = useState<Card[]>([]);
  const [progress, setProgress] = useState<SetProgress>({});
  const [sessionStats, setSessionStats] = useState<SessionStats>(EMPTY_SESSION_STATS);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!setId) return;
    getWordSetById(setId)
      .then((set) => {
        const currentProgress = ensureProgress(setId, set.cards);
        setWordSet(set);
        setProgress(currentProgress);
        setQueue(buildQueue(set.cards, currentProgress));
        setSessionStats(EMPTY_SESSION_STATS);
        setIndex(0);
        setFlipped(false);
      })
      .catch((e) => setError(e.message));
  }, [setId]);

  const total = queue.length;
  const card = queue[index];

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  const toggleFlip = useCallback(() => setFlipped((f) => !f), []);

  const handleGrade = useCallback(
    (grade: Grade) => {
      if (!setId || !card) return;
      const updatedProgress = recordReview(setId, card.id, grade);
      setProgress(updatedProgress);
      setSessionStats((s) => ({ ...s, [grade]: s[grade] + 1 }));
      if (grade === "again") {
        setQueue((q) => [...q, card]);
      }
      setFlipped(false);
      setIndex((i) => i + 1);
    },
    [setId, card],
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") {
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        goNext();
        return;
      }
      if (!flipped) return;
      if (e.key === "1") handleGrade("again");
      else if (e.key === "2") handleGrade("hard");
      else if (e.key === "3") handleGrade("good");
      else if (e.key === "4") handleGrade("easy");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext, flipped, handleGrade]);

  const cardState = card ? progress[card.id]?.state : undefined;
  const sessionTotal =
    sessionStats.again + sessionStats.hard + sessionStats.good + sessionStats.easy;
  const accuracy =
    sessionTotal === 0
      ? 0
      : Math.round(((sessionStats.good + sessionStats.easy) / sessionTotal) * 100);

  return (
    <div className="page">
      <header className="page-header">
        <Link to="/" className="btn-secondary">
          ← 목록
        </Link>
        <h1>{wordSet?.name ?? "학습"}</h1>
      </header>

      {error && <p className="error">{error}</p>}
      {!wordSet && !error && <p>불러오는 중...</p>}

      {wordSet && wordSet.cards.length === 0 && (
        <p className="empty-state">이 세트에는 카드가 없습니다.</p>
      )}
      {wordSet && wordSet.cards.length > 0 && total === 0 && (
        <p className="empty-state">오늘 학습할 카드가 없습니다. 모두 복습 완료! 🎉</p>
      )}

      {wordSet && total > 0 && index >= total && <SessionSummary stats={sessionStats} />}

      {card && (
        <div className="study-area">
          <div className="study-status">
            <ProgressIndicator current={index + 1} total={total} />
            {cardState && <span className="card-state-badge">{STATE_LABEL[cardState]}</span>}
          </div>

          {sessionTotal > 0 && (
            <p className="session-score-line">
              Again {sessionStats.again} · Hard {sessionStats.hard} · Good {sessionStats.good} ·
              Easy {sessionStats.easy} · 정답률 {accuracy}%
            </p>
          )}

          <Flashcard
            key={card.id}
            front={card.front}
            back={card.back}
            example={card.example}
            flipped={flipped}
            onFlip={toggleFlip}
          />

          <div className="study-nav">
            <button type="button" onClick={goPrev} disabled={index === 0} className="btn-secondary">
              ← 이전
            </button>
            <button type="button" onClick={toggleFlip} className="btn-primary">
              카드 뒤집기
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === total - 1}
              className="btn-secondary"
            >
              다음 →
            </button>
          </div>

          {flipped && <GradeButtons onGrade={handleGrade} />}
        </div>
      )}
    </div>
  );
}
