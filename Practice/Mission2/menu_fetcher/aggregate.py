"""여러 소스의 오늘 메뉴를 하나로 모은다.

공식 사이트(official_korea)가 있는 식당(학생회관/교우회관/산학관/자연계)은 공식 데이터를
우선하고, 공식 페이지가 없는 식당(안암학사/크림슨테이블/의대본관)만 koreapas로 보완한다.
파컬티하우스(송림)처럼 학생식당이 아닌 유료 식당은 별도로 분리해 대안 추천에만 쓴다.
"""

from datetime import date

from . import koreapas, official_korea


def collect_today(target_date: date | None = None) -> tuple[list[dict], list[dict]]:
    """(학생식당 메뉴 목록, 외부식당 메뉴 목록) 튜플을 반환한다."""
    target_date = target_date or date.today()

    student_rows: list[dict] = []
    for building_id in official_korea.BUILDINGS:
        student_rows.extend(official_korea.get_menu_for_date(building_id, target_date))

    koreapas_rows = koreapas.get_today_menu(target_date)
    student_rows.extend(row for row in koreapas_rows if row["id"] in koreapas.SUPPLEMENT_IDS)

    # 외부(유료) 식당은 official_korea 페이지가 이미 있으므로 그쪽 데이터를 쓴다
    # (koreapas의 동일 식당 데이터는 중복이라 제외).
    external_rows: list[dict] = []
    for building_id in official_korea.EXTERNAL_RESTAURANTS:
        external_rows.extend(official_korea.get_menu_for_date(building_id, target_date))

    return student_rows, external_rows


if __name__ == "__main__":
    today = date.today()
    student, external = collect_today(today)

    print(f"=== 오늘({today}) 학생식당 메뉴 비교 ===")
    for row in student:
        label = f"{row['restaurant']} [{row['meal_type']}]" if row["meal_type"] else row["restaurant"]
        if row["items"]:
            print(f"- {label}: {' / '.join(row['items'])}")
        else:
            print(f"- {label}: {row['note']}")

    print(f"\n=== 외부(유료) 식당 ===")
    for row in external:
        label = f"{row['restaurant']} [{row['meal_type']}]" if row["meal_type"] else row["restaurant"]
        print(f"- {label}: {'등록된 메뉴 없음' if not row['items'] else '메뉴 있음'}")
