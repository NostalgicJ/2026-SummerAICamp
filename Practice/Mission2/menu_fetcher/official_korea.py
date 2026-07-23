"""고려대학교 공식 사이트(www.korea.ac.kr)의 학생식당 주간 식단표를 가져와 파싱한다."""

import re
from datetime import date

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://www.korea.ac.kr/ko/{building_id}/subview.do"

# 확인된 건물별 학생식당 페이지 (page title로 실체 검증 완료)
BUILDINGS = {
    "508": "학생회관 학생식당",
    "507": "교우회관 학생식당",
    "506": "산학관 식당",
    "504": "자연계 학생식당(애기능)",
}

# 학생식당이 아닌 외부(유료) 식당 — 학생식당에 선호 메뉴가 없을 때의 대안 후보
EXTERNAL_RESTAURANTS = {
    "503": "수당삼양패컬티하우스(송림)",
}

NO_MENU_TEXT = "등록된 식단내용이(가) 없습니다."


def fetch_week_html(building_id: str) -> str:
    url = BASE_URL.format(building_id=building_id)
    res = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    res.raise_for_status()
    res.encoding = "utf-8"
    return res.text


def _parse_date(raw: str) -> date:
    # "2026.07.20. \n ( 월 )" -> 2026-07-20
    m = re.search(r"(\d{4})\.(\d{2})\.(\d{2})", raw)
    y, mo, d = map(int, m.groups())
    return date(y, mo, d)


def parse_week(html: str, building_id: str) -> list[dict]:
    """식단표 테이블을 파싱해서 [{restaurant, date, meal_type, items, note}, ...] 로 반환한다."""
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("div.table_1 table")
    if table is None:
        raise ValueError(f"'{building_id}' 페이지에서 식단표 테이블을 찾지 못했습니다.")

    restaurant = BUILDINGS.get(building_id) or EXTERNAL_RESTAURANTS.get(building_id, building_id)
    rows = []
    current_date = None
    # 식단구분(예: "중식")은 여러 줄(중식A/중식B)에 걸쳐 rowspan 되므로
    # 날짜(th)와 마찬가지로 남은 줄 수를 추적해서 값을 이어받아야 한다.
    meal_group = None
    meal_group_remaining = 0

    for tr in table.select("tbody tr"):
        th = tr.find("th")
        if th is not None:
            current_date = _parse_date(th.get_text(strip=True))

        tds = tr.find_all("td")
        if not tds or current_date is None:
            continue

        if meal_group_remaining <= 0:
            group_td = tds[0]
            meal_group = group_td.get_text(strip=True)
            meal_group_remaining = int(group_td.get("rowspan", 1))
            tds = tds[1:]
        meal_group_remaining -= 1

        if not tds:
            continue

        if len(tds) == 1 and tds[0].get("colspan") == "3":
            # 식단 미등록: 식단제목/식단내용/기타정보가 하나로 합쳐진 칸
            rows.append(
                {
                    "source": "official",
                    "restaurant": restaurant,
                    "date": current_date,
                    "meal_type": meal_group,
                    "items": [],
                    "note": tds[0].get_text(strip=True),
                }
            )
            continue

        title = tds[0].get_text(strip=True)
        meal_type = title if title else meal_group

        content_td = tds[1] if len(tds) > 1 else None
        items = []
        if content_td is not None:
            html_content = content_td.decode_contents()
            for line in re.split(r"<br\s*/?>", html_content):
                text = BeautifulSoup(line, "html.parser").get_text(strip=True)
                if text:
                    items.append(text)

        rows.append(
            {
                "source": "official",
                "restaurant": restaurant,
                "date": current_date,
                "meal_type": meal_type,
                "items": items,
                "note": "" if items else NO_MENU_TEXT,
            }
        )

    return rows


def get_menu_for_date(building_id: str, target_date: date) -> list[dict]:
    html = fetch_week_html(building_id)
    week = parse_week(html, building_id)
    return [row for row in week if row["date"] == target_date]


if __name__ == "__main__":
    today = date.today()
    for bid in BUILDINGS:
        menu = get_menu_for_date(bid, today)
        print(f"\n=== {BUILDINGS[bid]} ({today}) ===")
        if not menu:
            print("  이번 주 식단표에 오늘 날짜가 없습니다.")
            continue
        for row in menu:
            if row["items"]:
                print(f"  [{row['meal_type']}] {' / '.join(row['items'])}")
            else:
                print(f"  [{row['meal_type']}] {row['note']}")
