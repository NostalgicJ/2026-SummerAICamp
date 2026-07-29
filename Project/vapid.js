// Web Push용 VAPID 키 쌍을 최초 1회 생성해 재사용한다.
// 키가 바뀌면 기존에 등록된 모든 브라우저 구독이 무효화되므로 반드시 고정해서 재사용해야 한다.
// VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY 환경변수가 있으면 그걸 우선 사용한다 — 배포 환경(Render 등)은
// 재시작 시 파일시스템이 초기화될 수 있어 로컬 파일만 믿으면 배포될 때마다 키가 바뀌어버리기 때문.
// 환경변수가 없으면 로컬 개발 편의를 위해 data/vapid.json에 생성해 저장하고 재사용한다.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const VAPID_PATH = path.join(__dirname, 'data', 'vapid.json');

function getVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (fs.existsSync(VAPID_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8'));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_PATH, JSON.stringify(keys, null, 2), 'utf-8');
  console.log('새 VAPID 키 쌍을 생성해 data/vapid.json에 저장했습니다.');
  return keys;
}

module.exports = { getVapidKeys };
