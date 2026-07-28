// Web Push용 VAPID 키 쌍을 최초 1회 생성해 로컬 파일에 저장하고, 이후에는 그대로 재사용한다.
// 키가 바뀌면 기존에 등록된 모든 브라우저 구독이 무효화되므로 반드시 고정해서 재사용해야 한다.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

const VAPID_PATH = path.join(__dirname, 'data', 'vapid.json');

function getVapidKeys() {
  if (fs.existsSync(VAPID_PATH)) {
    return JSON.parse(fs.readFileSync(VAPID_PATH, 'utf-8'));
  }
  const keys = webpush.generateVAPIDKeys();
  fs.writeFileSync(VAPID_PATH, JSON.stringify(keys, null, 2), 'utf-8');
  console.log('새 VAPID 키 쌍을 생성해 data/vapid.json에 저장했습니다.');
  return keys;
}

module.exports = { getVapidKeys };
