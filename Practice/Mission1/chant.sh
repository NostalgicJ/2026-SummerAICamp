#!/usr/bin/env bash
set -euo pipefail

PROG_NAME="chant.sh"

# 응원가 가사에 포함되면 안 되는 금지 표현 (비속어 등). 필요하면 이 목록만 수정/확장하면 됨.
FORBIDDEN_WORDS=("씨발" "씨발놈" "개새끼" "병신" "지랄" "좆" "썅")

LEVEL=2

usage() {
  cat <<EOF
사용법: ./$PROG_NAME [--level 1|2|3] < 가사파일.txt

옵션:
  --level, -l   변환 강도 (1=약하게, 2=보통, 3=강하게, 기본값 2)

사전 준비:
  Claude Code CLI가 설치되어 있고 로그인되어 있어야 합니다. (claude --version 으로 확인)
  별도의 ANTHROPIC_API_KEY 발급/설정은 필요 없습니다.

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

if ! command -v claude >/dev/null 2>&1; then
  echo "오류: claude(Claude Code CLI)가 설치되어 있지 않습니다. https://claude.com/claude-code 안내를 참고해 설치 후 로그인하세요." >&2
  exit 1
fi

case "$LEVEL" in
  1) INSTRUCTION="원곡의 분위기와 가사 구조를 최대한 유지하면서, 응원가 느낌의 감탄사와 표현을 가볍게 섞어 넣어줘." ;;
  2) INSTRUCTION="응원가 특유의 후렴구(예: '이겨라', '나아가자')와 어휘를 적당히 사용해서 절반 정도는 응원가 스타일로 바꿔줘." ;;
  3) INSTRUCTION="원곡의 흔적이 거의 남지 않을 정도로 강렬하게, 응원가 후렴구와 함성, 감탄사를 적극적으로 사용해서 완전히 응원가로 다시 써줘." ;;
esac

FORBIDDEN_LIST=$(IFS=,; echo "${FORBIDDEN_WORDS[*]}")
SYSTEM_PROMPT="당신은 노래 가사를 한국 대학 응원가 스타일로 개사하는 전문가입니다.
${INSTRUCTION}
다음 표현은 결과에 절대 포함하지 마세요: ${FORBIDDEN_LIST}
개사한 가사만 출력하고, 다른 설명이나 인사말, 코드 블록 표시는 덧붙이지 마세요."

OUT_FILE="$(mktemp)"
ERR_FILE="$(mktemp)"
trap 'rm -f "$OUT_FILE" "$ERR_FILE"' EXIT

# claude CLI는 실패 시 오류 메시지를 stderr가 아니라 stdout에 출력하는 경우가 있어 둘 다 확인한다.
if claude -p "$LYRICS" \
  --append-system-prompt "$SYSTEM_PROMPT" \
  --disallowedTools "Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit,TodoWrite" \
  >"$OUT_FILE" 2>"$ERR_FILE"; then
  RESULT="$(cat "$OUT_FILE")"
else
  echo "오류: claude 호출이 실패했습니다: $(cat "$OUT_FILE") $(cat "$ERR_FILE")" >&2
  exit 1
fi

check_forbidden "$RESULT"

echo "$RESULT"
