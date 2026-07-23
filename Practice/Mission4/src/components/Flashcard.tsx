import "./Flashcard.css";

interface FlashcardProps {
  front: string;
  back: string;
  example?: string;
  flipped: boolean;
  onFlip: () => void;
}

export default function Flashcard({ front, back, example, flipped, onFlip }: FlashcardProps) {
  return (
    <div
      className="flashcard-stage"
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label="카드를 뒤집으려면 클릭하거나 스페이스바를 누르세요"
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onFlip();
        }
      }}
    >
      <div className={`flashcard ${flipped ? "is-flipped" : ""}`}>
        <div className="flashcard-face flashcard-front">
          <span className="flashcard-word">{front}</span>
        </div>
        <div className="flashcard-face flashcard-back">
          <span className="flashcard-word">{back}</span>
          {example && <span className="flashcard-example">{example}</span>}
        </div>
      </div>
    </div>
  );
}
