"""오늘 학생식당 메뉴 중 선호도에 따라 2곳을 추천한다.

- 메뉴에 선호 키워드가 있으면 가중치(스코어)를 준다.
- 학생식당 메뉴가 아예 없거나, 있어도 선호 메뉴가 하나도 없으면 외부 식당을 대안으로 추천한다.
"""

import json
from datetime import date
from pathlib import Path

from .aggregate import collect_today

# preferences.json이 없거나 읽을 수 없을 때만 쓰는 기본값
DEFAULT_PREFERENCES = ["돈까스", "제육", "치킨", "떡볶이", "파스타", "스테이크"]

PREFERENCES_PATH = Path(__file__).resolve().parent.parent / "preferences.json"


def load_preferences(path: Path = PREFERENCES_PATH) -> list[str]:
    """preferences.json에서 사용자가 등록한 선호 메뉴 키워드를 읽어온다."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return list(data["preferences"])
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return DEFAULT_PREFERENCES


def _score(items: list[str], preferences: list[str]) -> int:
    text = " ".join(items)
    return sum(1 for keyword in preferences if keyword in text)


def recommend(
    target_date: date | None = None,
    preferences: list[str] | None = None,
    top_n: int = 2,
) -> dict:
    target_date = target_date or date.today()
    preferences = load_preferences() if preferences is None else preferences

    student_rows, external_rows = collect_today(target_date)
    candidates = [row for row in student_rows if row["items"]]

    if not candidates:
        return {
            "status": "no_menu",
            "message": "오늘은 등록된 학생식당 메뉴가 없습니다. 외부 식당을 확인해보세요.",
            "picks": [],
            "fallback": external_rows,
        }

    scored = sorted(
        ((row, _score(row["items"], preferences)) for row in candidates),
        key=lambda pair: pair[1],
        reverse=True,
    )

    if scored[0][1] == 0:
        return {
            "status": "no_preference_match",
            "message": "선호 메뉴가 포함된 학생식당이 없어 외부 식당을 추천합니다.",
            "picks": [],
            "fallback": external_rows,
        }

    picks = [row for row, _ in scored[:top_n]]
    return {
        "status": "ok",
        "message": f"선호 메뉴 기준 상위 {len(picks)}곳을 추천합니다.",
        "picks": picks,
        "fallback": [],
    }


def _format_row(row: dict) -> str:
    label = f"{row['restaurant']} [{row['meal_type']}]" if row["meal_type"] else row["restaurant"]
    return f"{label}: {' / '.join(row['items'])}"


if __name__ == "__main__":
    result = recommend()
    print(result["message"])
    for row in result["picks"]:
        print(f"  - {_format_row(row)}")
    for row in result["fallback"]:
        label = f"{row['restaurant']} [{row['meal_type']}]" if row["meal_type"] else row["restaurant"]
        print(f"  (대안) {label}")
