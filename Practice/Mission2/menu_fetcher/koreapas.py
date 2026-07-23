"""koreapas.com 집계 사이트에서 고려대 여러 식당의 오늘 메뉴를 가져온다.

공식 사이트(www.korea.ac.kr)에 없는 식당(안암학사, 크림슨테이블, 의대본관 등)을
보완하기 위한 비공식 소스. EUC-KR로 인코딩되어 있고 사용자 리뷰와 메뉴가 한 페이지에
섞여 있어 구조가 공식 사이트보다 지저분하다.
"""

import re
from datetime import date

import requests
from bs4 import BeautifulSoup

URL = "https://www.koreapas.com/m/sik.php"

# id="508" 처럼 페이지에 등장하는 앵커 -> 식당 이름
RESTAURANTS = {
    "508": "학생회관",
    "509": "크림슨테이블",
    "505": "안암학사",
    "503": "송림(패컬티하우스)",
    "504": "자연계 학생식당",
    "506": "산학관",
    "502": "의대본관",
}

# official_korea.py가 이미 표 형태로 다루는 식당(508,506,504)은 koreapas를 쓰지 않고
# 공식 데이터를 우선한다. 아래 두 집합만 koreapas에서 가져와 보완/대안으로 쓴다.
SUPPLEMENT_IDS = {"509", "505", "502"}  # 공식 페이지가 없는 학생식당
EXTERNAL_IDS = {"503"}  # 학생식당이 아닌 유료 외부 식당(대안 추천용)

_ANCHOR_RE = re.compile(r'id="(\d{3})" style="height:1px;"')
_MEDU_RE = re.compile(
    r'<span class="medu">(?:&#\d+;)?\s*(?P<meal>[^<]+?)\s*</span></div>\s*'
    r"<div></div>\s*<div>(?P<content>.*?)</div>",
    re.DOTALL,
)


def fetch_html(target_date: date | None = None) -> str:
    params = {"date": target_date.isoformat()} if target_date else {}
    res = requests.get(URL, params=params, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
    res.raise_for_status()
    return res.content.decode("euc-kr", errors="ignore")


def _clean_items(content_html: str) -> list[str]:
    items = []
    for line in re.split(r"<br\s*/?>|<p>", content_html):
        text = BeautifulSoup(line, "html.parser").get_text(strip=True)
        text = text.strip("[]")
        if text:
            items.append(text)
    return items


def parse_today(html: str, target_date: date) -> list[dict]:
    """페이지 하나를 파싱해서 [{restaurant, date, meal_type, items}, ...] 로 반환한다.

    식당별 앵커(id="508" 등)는 최신 게시물부터 과거 게시물까지 페이지에 여러 번
    반복 등장한다(작성 시각이 "16시간 전", "1일 전"... 인 피드 형태). 오늘 메뉴에는
    가장 처음 등장하는(최신) 블록만 사용한다.
    """
    all_anchors = list(_ANCHOR_RE.finditer(html))
    first_anchor_by_rid: dict[str, re.Match] = {}
    for m in all_anchors:
        first_anchor_by_rid.setdefault(m.group(1), m)

    bounds = sorted(m.start() for m in all_anchors) + [len(html)]

    rows = []
    for rid, m in first_anchor_by_rid.items():
        if rid not in RESTAURANTS:
            continue
        next_bound = bounds[bounds.index(m.start()) + 1]
        segment = html[m.start() : next_bound]
        restaurant = RESTAURANTS[rid]

        meals_found = list(_MEDU_RE.finditer(segment))
        if not meals_found:
            rows.append(
                {
                    "source": "koreapas",
                    "id": rid,
                    "restaurant": restaurant,
                    "date": target_date,
                    "meal_type": None,
                    "items": [],
                    "note": "오늘 등록된 메뉴가 없습니다.",
                }
            )
            continue

        for meal_m in meals_found:
            items = _clean_items(meal_m.group("content"))
            rows.append(
                {
                    "source": "koreapas",
                    "id": rid,
                    "restaurant": restaurant,
                    "date": target_date,
                    "meal_type": meal_m.group("meal"),
                    "items": items,
                    "note": "" if items else "오늘 등록된 메뉴가 없습니다.",
                }
            )
    return rows


def get_today_menu(target_date: date | None = None) -> list[dict]:
    target_date = target_date or date.today()
    html = fetch_html(target_date)
    return parse_today(html, target_date)


if __name__ == "__main__":
    today = date.today()
    menu = get_today_menu(today)
    by_restaurant: dict[str, list[dict]] = {}
    for row in menu:
        by_restaurant.setdefault(row["restaurant"], []).append(row)

    for name, entries in by_restaurant.items():
        print(f"\n=== {name} ({today}) ===")
        for row in entries:
            if row["items"]:
                print(f"  [{row['meal_type']}] {' / '.join(row['items'])}")
            else:
                print(f"  {row['note']}")
