#!/usr/bin/env bash
set -euo pipefail

PROG_NAME="chant_v2.sh"

# 응원가 가사에 포함되면 안 되는 금지 표현 (비속어 등). 필요하면 이 목록만 수정/확장하면 됨.
FORBIDDEN_WORDS=("씨발" "씨발놈" "개새끼" "병신" "지랄" "좆" "썅")

# 강도별 단어 치환표 (누적 적용: level 2 = 1단계+2단계, level 3 = 1+2+3단계)
SUBS_L1_KEYS=("천천히" "조용히" "걸어" "걷다" "슬프다" "슬픔" "눈물" "혼자" "작은")
SUBS_L1_VALS=("힘차게" "우렁차게" "달려" "달리다" "뜨겁다" "뜨거움" "땀방울" "다함께" "커다란")

SUBS_L2_KEYS=("사랑" "마음" "떨리다" "그리움" "기다림" "이별" "포기" "약속")
SUBS_L2_VALS=("우리의 함성" "심장" "끓어오르다" "함성" "도전" "재회의 그날" "포효" "맹세")

SUBS_L3_KEYS=("밤" "하루" "길" "너" "우리")
SUBS_L3_VALS=("전장의 밤" "승부의 하루" "승리의 길" "전우여" "우리 전사들")

INTERJECTIONS=("오오~" "우와아~" "이야~" "자아~")

# 무드별 키워드/후렴구/오프닝·클로징 (레벨 2 이상에서 가사 내용에 맞춰 하나를 선택)
MOOD_TUJI_KEYWORDS=("싸우다" "이기다" "전쟁" "전투" "용기" "도전" "포기" "싸움")
MOOD_TUJI_REFRAINS=("이겨라! 이겨라! 나아가자!" "물러서지 마라! 끝까지 간다!" "포효하라! 우리가 간다!")
MOOD_TUJI_OPEN="다함께 외쳐보자!"
MOOD_TUJI_CLOSE="우리는 승리한다!"

MOOD_YEOLJEONG_KEYWORDS=("사랑" "마음" "그리움" "꿈" "청춘" "열정" "떨리다" "기다림")
MOOD_YEOLJEONG_REFRAINS=("청춘이여 타올라라!" "우리의 심장은 뜨겁다!" "멈추지 않는 열정으로!")
MOOD_YEOLJEONG_OPEN="심장을 뜨겁게 울려보자!"
MOOD_YEOLJEONG_CLOSE="우리의 청춘은 영원하다!"

MOOD_JILJU_KEYWORDS=("걷다" "걸어" "길" "달리다" "하루" "밤" "시간" "천천히" "조용히")
MOOD_JILJU_REFRAINS=("달려라! 멈추지 마라!" "질주하는 우리를 봐라!" "끝없는 길을 함께 달리자!")
MOOD_JILJU_OPEN="힘차게 달려나가자!"
MOOD_JILJU_CLOSE="우리는 끝까지 달린다!"

LEVEL=2

usage() {
  cat <<EOF
사용법: ./$PROG_NAME [--level 1|2|3] < 가사파일.txt

옵션:
  --level, -l   변환 강도 (1=약하게, 2=보통, 3=강하게, 기본값 2)

API 키나 네트워크 연결 없이 완전히 로컬에서 동작합니다.

표준 입력으로 원본 가사를 전달하세요. 예시:

  echo "너를 처음 만난 그날부터 내 마음은 떨리기 시작했어" | ./$PROG_NAME --level 2

또는 파일로 전달:

  ./$PROG_NAME --level 3 < lyrics.txt
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --level|-l)
      LEVEL="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $1" >&2
      exit 1
      ;;
  esac
done

if [[ "$LEVEL" != "1" && "$LEVEL" != "2" && "$LEVEL" != "3" ]]; then
  echo "오류: --level은 1, 2, 3 중 하나여야 합니다." >&2
  exit 1
fi

if [ -t 0 ]; then
  usage
  exit 0
fi

LYRICS="$(cat)"

if [[ -z "$LYRICS" || "$LYRICS" =~ ^[[:space:]]*$ ]]; then
  usage
  exit 0
fi

check_forbidden() {
  local text="$1"
  local word
  for word in "${FORBIDDEN_WORDS[@]}"; do
    if [[ "$text" == *"$word"* ]]; then
      echo "오류: 금지 표현이 포함되어 있습니다: $word" >&2
      exit 1
    fi
  done
}

check_forbidden "$LYRICS"

# 레벨에 맞는 치환표 구성 (누적)
KEYS=("${SUBS_L1_KEYS[@]}")
VALS=("${SUBS_L1_VALS[@]}")
if [[ "$LEVEL" -ge 2 ]]; then
  KEYS+=("${SUBS_L2_KEYS[@]}")
  VALS+=("${SUBS_L2_VALS[@]}")
fi
if [[ "$LEVEL" -ge 3 ]]; then
  KEYS+=("${SUBS_L3_KEYS[@]}")
  VALS+=("${SUBS_L3_VALS[@]}")
fi

INTERJ_IDX=0
REFRAIN_IDX=0

# $(...) 서브셸 안에서는 인덱스 증가가 부모 셸에 반영되지 않으므로,
# 함수 호출 대신 값 계산과 증가를 호출부에서 직접 처리한다.
next_interjection() {
  local idx=$((INTERJ_IDX % ${#INTERJECTIONS[@]}))
  NEXT_INTERJECTION="${INTERJECTIONS[$idx]}"
  INTERJ_IDX=$((INTERJ_IDX + 1))
}

next_refrain() {
  local idx=$((REFRAIN_IDX % ${#REFRAINS[@]}))
  NEXT_REFRAIN="${REFRAINS[$idx]}"
  REFRAIN_IDX=$((REFRAIN_IDX + 1))
}

count_keyword_hits() {
  local score=0
  local kw
  for kw in "$@"; do
    [[ "$LYRICS" == *"$kw"* ]] && score=$((score + 1))
  done
  echo "$score"
}

# 가사 내용에 맞는 무드 선택 (동점이면 투지형 우선)
TUJI_SCORE=$(count_keyword_hits "${MOOD_TUJI_KEYWORDS[@]}")
YEOLJEONG_SCORE=$(count_keyword_hits "${MOOD_YEOLJEONG_KEYWORDS[@]}")
JILJU_SCORE=$(count_keyword_hits "${MOOD_JILJU_KEYWORDS[@]}")

MAX_SCORE=$TUJI_SCORE
(( YEOLJEONG_SCORE > MAX_SCORE )) && MAX_SCORE=$YEOLJEONG_SCORE
(( JILJU_SCORE > MAX_SCORE )) && MAX_SCORE=$JILJU_SCORE

if (( TUJI_SCORE == MAX_SCORE )); then
  MOOD_NAME="투지"
  REFRAINS=("${MOOD_TUJI_REFRAINS[@]}")
  OPEN_LINE="$MOOD_TUJI_OPEN"
  CLOSE_LINE="$MOOD_TUJI_CLOSE"
elif (( YEOLJEONG_SCORE == MAX_SCORE )); then
  MOOD_NAME="열정"
  REFRAINS=("${MOOD_YEOLJEONG_REFRAINS[@]}")
  OPEN_LINE="$MOOD_YEOLJEONG_OPEN"
  CLOSE_LINE="$MOOD_YEOLJEONG_CLOSE"
else
  MOOD_NAME="질주"
  REFRAINS=("${MOOD_JILJU_REFRAINS[@]}")
  OPEN_LINE="$MOOD_JILJU_OPEN"
  CLOSE_LINE="$MOOD_JILJU_CLOSE"
fi

if [[ "$LEVEL" -ge 2 ]]; then
  echo "[선택된 무드: $MOOD_NAME] (투지=$TUJI_SCORE, 열정=$YEOLJEONG_SCORE, 질주=$JILJU_SCORE)" >&2
fi

OUT=()

if [[ "$LEVEL" -ge 2 ]]; then
  next_interjection
  OUT+=("$NEXT_INTERJECTION $OPEN_LINE")
fi

LINE_NO=0
while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
  line="$raw_line"
  for ((i = 0; i < ${#KEYS[@]}; i++)); do
    line="${line//${KEYS[$i]}/${VALS[$i]}}"
  done
  line="$(echo "$line" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  [[ -z "$line" ]] && continue
  LINE_NO=$((LINE_NO + 1))

  if [[ "$LEVEL" == "1" ]]; then
    [[ "$line" != *"!" ]] && line="${line}!"
    OUT+=("$line")
  elif [[ "$LEVEL" == "2" ]]; then
    [[ "$line" != *"!" ]] && line="${line}!"
    OUT+=("$line")
    if (( LINE_NO % 2 == 0 )); then
      next_refrain
      OUT+=("$NEXT_REFRAIN")
    fi
  else
    next_interjection
    OUT+=("$NEXT_INTERJECTION ${line}!!")
    next_refrain
    OUT+=("$NEXT_REFRAIN")
  fi
done <<< "$LYRICS"

if [[ "$LEVEL" -ge 2 ]]; then
  next_interjection
  OUT+=("$NEXT_INTERJECTION $CLOSE_LINE")
fi

RESULT="$(printf '%s\n' "${OUT[@]}")"

check_forbidden "$RESULT"

echo "$RESULT"
