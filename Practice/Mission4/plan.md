# 단어 암기 플래시카드 앱 - PRD

## 1. 개요

Anki 스타일 간격 반복(spaced repetition) 알고리즘을 적용한 단어 암기 웹앱.
단어 세트를 여러 개 등록하고, 세트를 선택해 플래시카드로 학습하며,
학습 이력에 따라 SM-2 알고리즘으로 다음 복습 시점을 자동 조절한다.

## 2. 기술 스택

- **프레임워크**: React + Vite
- **언어**: TypeScript
- **스타일링**: CSS (카드 flip 애니메이션은 CSS 3D transform 사용)
- **데이터 저장**
  - 단어 세트 원본: `/public/wordsets/*.json` (정적 파일, 세트 추가/삭제 시 파일 생성/삭제)
  - 학습 진행 상태(SM-2 스케줄, 반복 횟수, 통계): 브라우저 `localStorage`
- **생성 도구**: Claude Code Skill (`.claude/skills/wordset-generator` 형태) — 주제를 주면 단어/뜻 JSON 세트를 생성

## 3. 데이터 모델

### 3.1 단어 세트 파일 (`/public/wordsets/<setId>.json`)

```json
{
  "id": "latin-basics-1",
  "name": "라틴어 기초 어휘 1",
  "description": "일상 라틴어 기본 단어 30개",
  "language": { "front": "la", "back": "ko" },
  "cards": [
    {
      "id": "c001",
      "front": "aqua",
      "back": "물",
      "example": "Aqua vitae necessaria est."
    }
  ]
}
```

- `id`: 세트 고유 키 (파일명과 동일)
- `cards[].id`: 세트 내 카드 고유 키 (스케줄 데이터와 매핑용)
- `example`: 선택 항목, 카드 뒷면에 예문으로 표시

### 3.2 세트 목록 인덱스 (`/public/wordsets/index.json`)

```json
{
  "sets": ["latin-basics-1", "english-toeic-1"]
}
```

- 세트 추가/삭제 시 이 인덱스도 함께 갱신 (설정 화면에서 처리)

### 3.3 학습 진행 상태 (`localStorage["progress:<setId>"]`)

카드별 SM-2 스케줄 정보:

```json
{
  "c001": {
    "repetitions": 2,
    "easeFactor": 2.5,
    "intervalDays": 6,
    "dueDate": "2026-07-28",
    "lastReviewedDate": "2026-07-22",
    "state": "review",
    "history": [
      { "date": "2026-07-20", "grade": "good" },
      { "date": "2026-07-22", "grade": "easy" }
    ]
  }
}
```

- `state`: `new | learning | review`
- `history`: 세트별 반복 학습 횟수/추이 확인용 (요구사항: "세트마다 얼마나 반복해서 학습했는지")

### 3.4 세트별 통계 (`localStorage["stats:<setId>"]`)

```json
{
  "totalReviews": 42,
  "lastStudiedDate": "2026-07-22",
  "cardsByState": { "new": 5, "learning": 3, "review": 22 }
}
```

## 4. 화면 구성

### 4.1 세트 선택 화면 (홈)

- 등록된 단어 세트 목록 카드 형태로 표시
- 각 세트에 진행률(예: review 상태 카드 비율), 오늘 복습 예정 카드 수 표시
- 세트 클릭 → 학습 화면으로 이동
- 상단에 "설정" 버튼 → 설정 화면 이동

### 4.2 설정 화면

- 등록된 세트 목록 (이름, 카드 수, 삭제 버튼)
- 세트 추가: JSON 파일 업로드 또는 붙여넣기로 신규 세트 등록
- 세트별 누적 학습 통계(총 리뷰 횟수, 마지막 학습일) 표시
- 삭제 시 확인 다이얼로그, localStorage의 progress/stats도 함께 정리

### 4.3 학습 화면

- **플래시카드**: 중앙에 카드, 클릭/스페이스바로 앞↔뒤 flip (CSS 3D transform, ~300ms transition)
  - 앞면: 단어 (front)
  - 뒷면: 뜻(back) + 예문(example, 있으면)
- **진행 표시**: "3 / 20" 형태로 현재 카드 순번 / 오늘의 큐 총 개수
- **이전/다음 이동**: 좌우 화살표 버튼 또는 키보드 방향키 (단, 평가 전 카드는 재노출 큐에 남음 — Anki 규칙 유지)
- **평가 버튼 (카드 뒤집은 후 노출)**: Again / Hard / Good / Easy 4단계
- **세션 점수 표시**: 현재 세션에서 평가한 카드 수, 등급별 분포(예: Again 2 · Hard 1 · Good 10 · Easy 3), 정답률(=Good+Easy 비율)
- 세션 종료(큐 소진) 시 요약 화면: 오늘 학습한 카드 수, 다음 복습 예정일 요약

## 5. Anki(SM-2 간소화) 알고리즘 설계

### 5.1 카드 상태

- `new`: 한 번도 학습 안 함
- `learning`: 학습 중(짧은 간격으로 반복, 아직 정식 SM-2 간격 진입 전)
- `review`: SM-2 정식 간격 적용 중

### 5.2 평가 등급 → 처리

| 등급 | 의미 | 효과 |
|------|------|------|
| Again | 틀림/기억 안 남 | `repetitions=0`, `intervalDays=1(또는 분 단위 재노출)`, `easeFactor -= 0.2` (최소 1.3), 상태 `learning`으로 리셋, 오늘 세션 큐 뒤쪽에 재삽입 |
| Hard | 기억은 났지만 어려움 | `intervalDays *= 1.2`, `easeFactor -= 0.15` (최소 1.3) |
| Good | 정상적으로 기억함 | 표준 SM-2 간격 계산 (아래) |
| Easy | 매우 쉬움 | 표준 SM-2 간격 계산 * 1.3, `easeFactor += 0.15` |

표준 SM-2 간격 계산 (Good 기준):
- `repetitions == 0` → `interval = 1일`
- `repetitions == 1` → `interval = 6일`
- `repetitions >= 2` → `interval = 이전 interval * easeFactor`
- 매 성공 평가마다 `repetitions += 1`
- `easeFactor` 초기값 2.5, 범위 [1.3, 2.5+]

### 5.3 오늘의 학습 큐 구성

1. `dueDate <= 오늘`인 `review` 카드
2. `learning` 상태 카드 (재노출 대기 중인 것)
3. `new` 카드 중 세트별 일일 신규 카드 제한(기본 10장, 설정 가능성 있으나 MVP는 고정값)
4. Again으로 평가된 카드는 같은 세션 큐 끝부분에 다시 삽입 (Anki의 "다시 보기" 동작 반영)

## 6. 단어 세트 생성 스킬

- 위치: `.claude/skills/wordset-generator/SKILL.md`
- 입력: 주제(예: "라틴어 기초 동사 30개", "TOEIC 필수 단어 50개"), 언어 쌍, 카드 수
- 동작: LLM이 단어/뜻/예문 목록을 생성 → 3.1 스키마에 맞는 JSON 파일 생성 → `/public/wordsets/`에 저장하고 `index.json`에 등록
- 출력 검증: 중복 단어 제거, 스키마 유효성 체크

## 7. 단계별 구현 계획

1. **Step 1 - 프로젝트 뼈대**: Vite+React+TS 셋업, 라우팅(세트 목록/설정/학습 3개 화면), 더미 단어 세트 1개로 레이아웃 구성
2. **Step 2 - 플래시카드 UI**: flip 애니메이션, 이전/다음 네비게이션, 진행 표시
3. **Step 3 - SM-2 알고리즘**: 스케줄링 로직(순수 함수, 단위 테스트), localStorage 연동, 오늘의 큐 구성 로직
4. **Step 4 - 평가 버튼 + 세션 점수**: 4단계 평가 UI, 세션 통계 계산/표시, 세션 종료 요약
5. **Step 5 - 설정 화면**: 세트 추가/삭제, JSON 업로드, 세트별 누적 통계 표시
6. **Step 6 - 단어 세트 생성 스킬**: Claude Code Skill 작성, 샘플 세트(한국어/영어/라틴어) 2~3개 생성
7. **Step 7 - 다듬기**: 반응형/접근성(키보드 조작), 엣지 케이스(빈 세트, 신규 세트 없음) 처리

각 단계는 별도 대화창(또는 `/clear`) 단위로 진행 가능하도록 독립적으로 검증 가능하게 설계.

## 8. 폴더 구조 (예상)

```
Mission4/
  plan.md
  index.html
  package.json
  vite.config.ts
  public/
    wordsets/
      index.json
      latin-basics-1.json
  src/
    main.tsx
    App.tsx
    types.ts               # WordSet, Card, Progress 타입
    lib/
      sm2.ts                # SM-2 스케줄링 순수 함수 + 테스트
      storage.ts             # localStorage 읽기/쓰기 헬퍼
      queue.ts               # 오늘의 학습 큐 구성 로직
    pages/
      SetListPage.tsx
      SettingsPage.tsx
      StudyPage.tsx
    components/
      Flashcard.tsx
      GradeButtons.tsx
      ProgressIndicator.tsx
      SessionSummary.tsx
  .claude/
    skills/
      wordset-generator/
        SKILL.md
```
