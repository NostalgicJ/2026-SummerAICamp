import { describe, expect, it } from "vitest";
import { applyGrade, createInitialProgress } from "./sm2";

const DAY0 = "2026-07-20";

describe("sm2.applyGrade", () => {
  it("first Good sets a 1-day interval and keeps state learning", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "good", DAY0);

    expect(p1.repetitions).toBe(1);
    expect(p1.intervalDays).toBe(1);
    expect(p1.dueDate).toBe("2026-07-21");
    expect(p1.state).toBe("learning");
  });

  it("second Good sets a 6-day interval and moves to review", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "good", DAY0);
    const p2 = applyGrade(p1, "good", "2026-07-21");

    expect(p2.repetitions).toBe(2);
    expect(p2.intervalDays).toBe(6);
    expect(p2.dueDate).toBe("2026-07-27");
    expect(p2.state).toBe("review");
  });

  it("third Good multiplies the previous interval by the ease factor", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "good", DAY0);
    const p2 = applyGrade(p1, "good", "2026-07-21");
    const p3 = applyGrade(p2, "good", "2026-07-27");

    expect(p3.repetitions).toBe(3);
    expect(p3.intervalDays).toBe(15); // 6 * 2.5
    expect(p3.state).toBe("review");
  });

  it("Again resets repetitions/interval and lowers ease, regardless of prior progress", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "good", DAY0);
    const p2 = applyGrade(p1, "good", "2026-07-21");
    const p3 = applyGrade(p2, "again", "2026-07-27");

    expect(p3.repetitions).toBe(0);
    expect(p3.intervalDays).toBe(1);
    expect(p3.easeFactor).toBe(2.3);
    expect(p3.state).toBe("learning");
    expect(p3.dueDate).toBe("2026-07-28");
  });

  it("Hard grows the interval slower and lowers ease slightly", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "good", DAY0); // interval 1
    const p2 = applyGrade(p1, "good", "2026-07-21"); // interval 6
    const p3 = applyGrade(p2, "hard", "2026-07-27");

    expect(p3.intervalDays).toBe(7.2); // 6 * 1.2
    expect(p3.easeFactor).toBe(2.35);
    expect(p3.repetitions).toBe(3);
  });

  it("Easy grows the interval faster and raises ease", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "easy", DAY0);

    // repetitions 0 -> base interval 1, * 1.3 = 1.3
    expect(p1.intervalDays).toBe(1.3);
    expect(p1.easeFactor).toBe(2.65);
    expect(p1.repetitions).toBe(1);
  });

  it("ease factor never drops below 1.3", () => {
    let p = createInitialProgress(DAY0);
    for (let i = 0; i < 20; i++) {
      p = applyGrade(p, "again", DAY0);
    }
    expect(p.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("records each review in history", () => {
    const p0 = createInitialProgress(DAY0);
    const p1 = applyGrade(p0, "good", DAY0);
    const p2 = applyGrade(p1, "easy", "2026-07-21");

    expect(p2.history).toEqual([
      { date: DAY0, grade: "good" },
      { date: "2026-07-21", grade: "easy" },
    ]);
  });
});
