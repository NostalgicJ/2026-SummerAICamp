import type { Grade } from "../types";
import "./GradeButtons.css";

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: "again", label: "Again", hint: "다시 (1)" },
  { grade: "hard", label: "Hard", hint: "어려움 (2)" },
  { grade: "good", label: "Good", hint: "적당함 (3)" },
  { grade: "easy", label: "Easy", hint: "쉬움 (4)" },
];

interface GradeButtonsProps {
  onGrade: (grade: Grade) => void;
}

export default function GradeButtons({ onGrade }: GradeButtonsProps) {
  return (
    <div className="grade-buttons">
      {GRADES.map(({ grade, label, hint }) => (
        <button
          key={grade}
          type="button"
          className={`grade-btn grade-btn-${grade}`}
          onClick={() => onGrade(grade)}
        >
          <span className="grade-label">{label}</span>
          <span className="grade-hint">{hint}</span>
        </button>
      ))}
    </div>
  );
}
