# TODO / 칸반 — 코딩테스트 데일리

[PRD.md](PRD.md) §15 단계별 구현 순서를 기준으로 한다. 항목을 완료할 때마다 체크하고, 진행 중인 항목은 `[~]`로 표시한다.

## Phase 0 — 프로젝트 셋업
- [x] 작업 폴더 구조 확정 (`server.js`, `public/`, `data/`) — `storage.js`/`github-suggest.js`는 Phase 4/7에서 추가
- [x] package.json 및 기본 의존성 설치 (express)
- [x] `data/problems.json` 초기 스키마 파일 생성
- [x] 서버 기동 확인 (`GET /` 응답, 정적 파일 서빙)

## Phase 1 — 핵심 MVP: 오늘의 문제 조회 (알림 없음)
- [x] 기업별 대표 문제 29개 `problems.json`에 초기 입력 (`id, company, name, plat, level, tags, url, exp`) — 원본 문제 본문 복제 없이 자체 작성 요약(exp)만 사용
  - 최초 초안은 백준 23개 + 프로그래머스 6개였으나, 백준이 2026-04-28부로 서비스 종료된 것을 확인해 백준 23개를 전부 프로그래머스의 살아있는 문제로 교체(브라우저로 각 링크 실접속 확인 후 반영)
  - 리트코드 9문제(기업군별 1개씩) 추가, 전부 실접속 확인 후 반영 → 현재 총 38개(프로그래머스 29 / 리트코드 9)
  - 코드시그널·코드트리는 로그인 없이 개별 문제 직링크가 확인되지 않아 이번 범위에서는 보류(PRD §12 참고)
- [x] 날짜 기반 순차 로테이션 로직 구현
- [x] `GET /api/today` 구현 (필터 없이 전체 문제 대상)
- [x] 최소 프론트엔드: 오늘의 문제 카드(기업/문제명/플랫폼/난이도/태그/exp/링크) 표시
- [x] **검증**: 브라우저 접속 시 오늘의 문제가 정상 표시되고, 링크가 원본 문제 페이지로 정확히 연결됨을 확인 (2026-07-23 기준)

## Phase 2 — 사용자별 설정 및 필터
- [ ] 브라우저 익명 `clientId` 발급 및 로컬 저장 로직
- [ ] `GET /api/settings` / `POST /api/settings` 구현 (없으면 기본값 생성)
- [ ] 기업/태그/난이도 다중 선택 필터 UI + 서버 반영
- [ ] 출제 순서 옵션: 순차 / 랜덤(날짜+시드) / 안 푼 우선
- [ ] 필터에 맞는 문제가 없을 때 전체 문제로 대체 선택
- [ ] **검증**: 설정 변경 후 `/api/today` 결과가 필터·순서에 맞게 바뀌는지 확인

## Phase 3 — 오늘의 문제 상호작용
- [ ] `POST /api/skip-today` (동일 조건에서 재선정)
- [ ] `POST /api/mark-solved` (solved_ids 반영)
- [ ] `POST /api/reset-progress` (solved_ids 초기화)
- [ ] **검증**: 건너뛰기/풀었음 체크가 "안 푼 우선" 모드에 실제로 반영되는지 확인

## Phase 4 — 데이터 영속성
- [ ] `storage.js` 저장소 추상화 인터페이스 설계
- [ ] 로컬 JSON 파일 폴백 구현 (DB 미설정 시)
- [ ] Neon Postgres `subscribers` 테이블 설계 및 연동 (`DATABASE_URL` 존재 시)
- [ ] **검증**: 서버 재시작 후에도 설정·진행 상태가 유지되는지 확인

## Phase 5 — PWA / Web Push 인프라
- [ ] `manifest.json` 및 아이콘 준비, 홈 화면 추가 동작 확인 (iOS 16.4+)
- [ ] 서비스 워커: 푸시 수신 처리 + 알림 클릭 시 앱 진입
- [ ] `POST /api/subscribe` / `POST /api/unsubscribe` 구현
- [ ] "알림 켜기" UI 흐름 (구독 등록)
- [ ] **검증**: 테스트 발송으로 실제 기기 알림 수신 확인

## Phase 6 — 알림 스케줄링 자동화
- [ ] `POST /api/send-daily` 발송 대상 판정 로직 (시간/요일/일시정지/중복 발송 방지)
- [ ] `POST /api/resend-today` 구현
- [ ] 크론 엔드포인트 시크릿 키 보호
- [ ] GitHub Actions 또는 cron-job.org 15분 주기 트리거 연동
- [ ] **검증**: 목표 시각 대비 30분 이내 발송, 중복 미발송 확인

## Phase 7 — 문제 제안 → GitHub PR 자동화
- [ ] 문제 제안 폼 UI (완전 공개)
- [ ] `POST /api/suggest-problem` 구현
- [ ] `github-suggest.js`: 브랜치 생성 → `problems.json` 커밋 → PR 생성
- [ ] 저장소 범위 제한 Fine-grained PAT 설정
- [ ] **검증**: 제안 제출 시 실제 PR이 생성되고, 병합 시 문제 목록에 반영되는지 확인

## Phase 8 — 배포 및 운영
- [ ] Render Web Service 배포
- [ ] Neon Postgres 연결 (환경변수 `DATABASE_URL`)
- [ ] 크론 서비스(GitHub Actions/cron-job.org) 운영 환경 등록
- [ ] 시크릿/PAT 등 환경변수 정리 및 보안 점검
- [ ] **검증**: 배포 환경에서 전체 사용자 흐름(설정→알림→상호작용→제안) 종단 테스트

## Phase 9+ — 향후 로드맵 (Optional)
- [ ] 통계 대시보드 (스트릭, 기업/태그별 풀이 현황)
- [ ] 다중 알림 채널 (이메일/카카오톡 등)
- [ ] 난이도 자동 조정 추천
- [ ] 관리자 승인 플로우 (PR 없이 빠른 반영)
