const CLIENT_ID_KEY = 'ctd_client_id';

function getClientId() {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const clientId = getClientId();

// 난이도 기반 예상 풀이 시간 (문제별 정답 데이터가 없어 난이도로만 어림잡은 값)
function estimateTime(level) {
  const table = { 1: '15~20분', 2: '25~35분', 3: '40~60분' };
  return table[level] || '30~40분';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((err) => {
    console.error('서비스 워커 등록 실패:', err);
  });
}

// PC/모바일 보기 강제 전환 — 실제 화면 크기와 무관하게 사용자가 직접 고른 레이아웃을 기억한다.
const VIEW_MODE_KEY = 'algoping_view';

function applyViewMode(mode) {
  document.documentElement.dataset.view = mode;
  localStorage.setItem(VIEW_MODE_KEY, mode);
}

function initViewToggle() {
  // <head>의 인라인 스크립트가 이미 저장된 값(또는 화면 폭 기반 기본값)을 설정해둔다.
  // 혹시 그 스크립트가 없는 페이지라면 여기서 같은 규칙으로 한 번 더 계산한다.
  if (!document.documentElement.dataset.view) {
    document.documentElement.dataset.view =
      localStorage.getItem(VIEW_MODE_KEY) || (matchMedia('(min-width: 700px)').matches ? 'desktop' : 'mobile');
  }

  const btn = document.createElement('button');
  btn.id = 'viewToggleBtn';
  btn.type = 'button';

  function refreshLabel() {
    const current = document.documentElement.dataset.view;
    btn.textContent = current === 'desktop' ? '📱 모바일로 보기' : '🖥 PC로 보기';
    btn.setAttribute('aria-label', current === 'desktop' ? '모바일 레이아웃으로 전환' : 'PC 레이아웃으로 전환');
  }

  // PC 모드에서는 사이드바 내비 바로 아래에 작게 두고, 모바일 모드에서는 카드 버튼과
  // 헷갈리지 않도록 페이지 맨 아래에 독립된 섹션으로 옮겨 둔다.
  function positionButton() {
    const current = document.documentElement.dataset.view;
    if (current === 'desktop') {
      btn.className = 'view-toggle-btn view-toggle-btn--desktop';
      const anchor = document.querySelector('.sidebar .topnav') || document.querySelector('.topnav') || document.querySelector('.back-link') || document.querySelector('.brand');
      if (anchor) anchor.insertAdjacentElement('afterend', btn);
      else document.body.appendChild(btn);
    } else {
      btn.className = 'view-toggle-btn view-toggle-btn--mobile-section';
      const container = document.querySelector('.main-content') || document.body;
      container.appendChild(btn);
    }
  }

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.view === 'desktop' ? 'mobile' : 'desktop';
    applyViewMode(next);
    refreshLabel();
    positionButton();
  });

  refreshLabel();
  positionButton();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initViewToggle);
} else {
  initViewToggle();
}

// 첫 방문 온보딩 코치마크 — 어느 페이지로 처음 들어오든 한 번만 보여주고 다시는 안 띄운다.
const ONBOARDING_KEY = 'algoping_onboarded';
const ONBOARDING_STEPS = [
  {
    emoji: '👋',
    title: '알고핑에 오신 걸 환영해요!',
    body: '매일 기업 맞춤 코딩테스트 문제를 추천해드려요. 상단 탭에서 오늘의 문제 · 풀이 기록 · 알고리즘 · 설정을 오갈 수 있어요.',
  },
  {
    emoji: '🖥️',
    title: 'PC/모바일 화면 전환',
    body: '"PC로 보기" 버튼을 누르면 화면 크기와 상관없이 넓은 레이아웃으로 볼 수 있어요. 언제든 다시 바꿀 수 있어요.',
  },
  {
    emoji: '🔔',
    title: '알림도 받아보세요',
    body: '설정 탭에서 알림을 켜면 정해둔 시간에 오늘의 문제가 도착해요.',
  },
];

function initOnboarding() {
  if (localStorage.getItem(ONBOARDING_KEY)) return;

  let step = 0;
  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.innerHTML = `
    <div class="onboarding-card">
      <div class="onboarding-emoji" id="obEmoji"></div>
      <h3 id="obTitle"></h3>
      <p id="obBody"></p>
      <div class="onboarding-dots" id="obDots"></div>
      <div class="onboarding-actions">
        <button class="text-btn" id="obSkip" type="button">건너뛰기</button>
        <button class="save-btn" id="obNext" type="button">다음</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  function render() {
    const s = ONBOARDING_STEPS[step];
    overlay.querySelector('#obEmoji').textContent = s.emoji;
    overlay.querySelector('#obTitle').textContent = s.title;
    overlay.querySelector('#obBody').textContent = s.body;
    overlay.querySelector('#obDots').innerHTML = ONBOARDING_STEPS.map(
      (_, i) => `<span class="dot${i === step ? ' active' : ''}"></span>`
    ).join('');
    overlay.querySelector('#obNext').textContent = step === ONBOARDING_STEPS.length - 1 ? '시작하기' : '다음';
  }

  function close() {
    localStorage.setItem(ONBOARDING_KEY, '1');
    overlay.remove();
  }

  overlay.querySelector('#obSkip').addEventListener('click', close);
  overlay.querySelector('#obNext').addEventListener('click', () => {
    if (step === ONBOARDING_STEPS.length - 1) {
      close();
      return;
    }
    step += 1;
    render();
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnboarding);
} else {
  initOnboarding();
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('이 브라우저는 Web Push를 지원하지 않습니다.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 거부되었습니다.');
  }

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await fetch('/api/vapid-public-key').then((r) => r.json());

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, subscription }),
  });

  return subscription;
}

async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();

  await fetch('/api/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });
}

async function getPushSubscriptionState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription ? 'subscribed' : 'unsubscribed';
}
