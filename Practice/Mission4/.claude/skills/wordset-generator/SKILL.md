---
name: wordset-generator
description: Generate a new vocabulary/word-set JSON file for the Mission4 Anki-style flashcard app (this project), given a topic, language pair, and/or card count. Use when the user asks to create, add, or generate a new word set / flashcard deck for this app — e.g. "라틴어 기초 동사 30개 세트 만들어줘", "TOEIC 필수 단어 50개 세트 추가해줘", "일본어 인사말 세트 만들어줘", "add a new word set about cooking verbs".
---

# 단어 세트 생성 스킬 (wordset-generator)

Mission4 플래시카드 앱에서 쓰는 **내장(built-in) 단어 세트**를 생성해 `public/wordsets/`에 저장하는 스킬입니다.
(사용자가 앱의 "설정" 화면에서 JSON을 직접 붙여넣어 추가하는 커스텀 세트와는 별개의, 저장소에 영구히 포함되는 세트를 만들 때 사용합니다.)

## 입력 파악

사용자 요청에서 다음을 파악합니다. 명시되지 않으면 괄호의 기본값을 사용합니다.

- **주제**: 예) "라틴어 기초 동사", "TOEIC 필수 단어", "일본어 인사말"
- **언어 쌍** (front → back): 기본값은 앞면 = 주제에 맞는 외국어, 뒷면 = 한국어(`ko`)
- **카드 수** (기본값 20, 최대 60 권장 — 너무 많으면 학습 세션이 부담스러워짐)

## 데이터 스키마

`src/types.ts`의 `WordSet` / `Card` 타입을 따릅니다:

```json
{
  "id": "kebab-case-unique-id",
  "name": "사람이 읽는 세트 이름",
  "description": "한 줄 설명",
  "language": { "front": "언어코드(예: la, en, ja, ko)", "back": "ko" },
  "cards": [
    { "id": "c001", "front": "단어/표현", "back": "뜻", "example": "예문(선택, front 언어로 작성)" }
  ]
}
```

- `cards[].id`는 세트 내에서 유일해야 하며 `c001`, `c002`, ... 형식을 권장합니다 (학습 진행 상태와 매핑되는 키이므로, 한 번 배포한 뒤에는 바꾸지 않습니다).
- `example`은 선택 항목이지만, 있으면 학습 경험이 좋아지므로 가능하면 채웁니다.
- 세트 안에서 `front` 값(단어)이 중복되지 않도록 합니다.

## 절차

1. **기존 세트 확인**: `public/wordsets/index.json`을 읽어 등록된 세트 id 목록을 확인합니다.
2. **id 결정**: 주제를 kebab-case로 슬러그화하고, 기존 id와 충돌하면 `-2`, `-3` 등을 붙입니다.
3. **카드 생성**: 요청된 주제/언어/개수에 맞는 단어-뜻 쌍을 생성합니다.
   - 실존하는 정확한 단어와 번역만 사용합니다 (지어내지 않습니다).
   - 각 카드에 짧고 자연스러운 예문을 `example`에 넣습니다 (front 언어로).
   - 초급자가 이해하기 쉬운 순서(빈도 높은 단어 우선)로 배치하면 좋습니다.
4. **검증**: 아래를 스스로 점검합니다.
   - `id`/`cards[].id`가 모두 유일한가?
   - `front` 단어 중복이 없는가?
   - 카드 수가 요청과 일치하는가(또는 차이가 있다면 이유를 사용자에게 설명)?
5. **파일 작성**: `public/wordsets/<id>.json`에 위 스키마대로 저장합니다.
6. **인덱스 갱신**: `public/wordsets/index.json`의 `sets` 배열에 새 id를 추가합니다 (중복 추가 금지).
7. **결과 보고**: 세트 이름, id, 카드 수, 언어 쌍을 사용자에게 요약합니다. dev 서버가 켜져 있다면 별도 재시작 없이 "단어 세트" 목록 화면에 바로 나타납니다.

## 예시

사용자: "스페인어 여행 회화 15개 세트 만들어줘"

→ `public/wordsets/spanish-travel-phrases.json` 생성 (id: `spanish-travel-phrases`, language: `{ front: "es", back: "ko" }`, cards 15개, 각 카드에 실제 스페인어 여행 표현 + 한국어 뜻 + 예문) 후 `index.json`에 `spanish-travel-phrases` 추가.
