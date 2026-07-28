// 사용자가 제안한 문제를 GitHub API로 새 브랜치 + 커밋 + PR까지 자동 생성한다.
// 저장소 소유자가 PR을 검토·병합해야 실제로 problems.json에 반영된다(자동 병합 없음).
//
// 필요한 환경변수:
//   GITHUB_TOKEN       - contents:write, pull-requests:write 권한을 가진 Fine-grained PAT
//   GITHUB_REPO        - "owner/repo" 형식 (기본값: 이 프로젝트의 실제 저장소)
//   GITHUB_BASE_BRANCH - PR을 만들 기준 브랜치 (기본값: main)

const GITHUB_API = 'https://api.github.com';
const REPO = process.env.GITHUB_REPO || 'NostalgicJ/2026-SummerAICamp';
const BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || 'main';
const PROBLEMS_PATH_IN_REPO = 'Project/data/problems.json';

function isConfigured() {
  return !!process.env.GITHUB_TOKEN;
}

async function githubFetch(path, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json();
}

function slugify(text) {
  return text
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'problem';
}

// problem: { company, name, plat, level, tags, url, keyPoint, approach }
async function suggestProblem(problem) {
  if (!isConfigured()) {
    const err = new Error('GITHUB_TOKEN이 설정되지 않아 문제 제안 기능을 사용할 수 없습니다.');
    err.notConfigured = true;
    throw err;
  }

  // 1) 기준 브랜치의 최신 커밋 SHA 조회
  const baseRef = await githubFetch(`/repos/${REPO}/git/ref/heads/${BASE_BRANCH}`);
  const baseSha = baseRef.object.sha;

  // 2) 새 브랜치 생성
  const branchName = `suggest-problem/${slugify(problem.company)}-${slugify(problem.name)}-${Date.now()}`;
  await githubFetch(`/repos/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: baseSha }),
  });

  // 3) 새 브랜치에서 problems.json 현재 내용 + sha 조회
  const fileData = await githubFetch(
    `/repos/${REPO}/contents/${PROBLEMS_PATH_IN_REPO}?ref=${branchName}`
  );
  const currentProblems = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));

  // 4) 새 문제 추가 (id 중복 방지)
  const baseId = `${slugify(problem.company)}-${slugify(problem.name)}`;
  let id = baseId;
  let suffix = 2;
  const existingIds = new Set(currentProblems.map((p) => p.id));
  while (existingIds.has(id)) {
    id = `${baseId}-${suffix}`;
    suffix++;
  }

  const newProblem = {
    id,
    company: problem.company,
    name: problem.name,
    plat: problem.plat,
    level: problem.level,
    tags: problem.tags,
    url: problem.url,
    keyPoint: problem.keyPoint,
    approach: problem.approach,
  };
  const updatedProblems = [...currentProblems, newProblem];

  // 5) 새 브랜치에 problems.json 커밋
  const updatedContent = Buffer.from(JSON.stringify(updatedProblems, null, 2) + '\n', 'utf-8').toString('base64');
  await githubFetch(`/repos/${REPO}/contents/${PROBLEMS_PATH_IN_REPO}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: `문제 제안: ${problem.company} - ${problem.name}`,
      content: updatedContent,
      sha: fileData.sha,
      branch: branchName,
    }),
  });

  // 6) PR 생성
  const pr = await githubFetch(`/repos/${REPO}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: `[문제 제안] ${problem.company} - ${problem.name}`,
      head: branchName,
      base: BASE_BRANCH,
      body: [
        '사용자가 AlGoPing 문제 제안 폼으로 제출한 문제입니다.',
        '',
        `- 기업: ${problem.company}`,
        `- 플랫폼: ${problem.plat}`,
        `- 난이도: ${problem.level}`,
        `- 태그: ${problem.tags}`,
        `- 링크: ${problem.url}`,
        '',
        '저장소 소유자가 검토 후 병합해야 실제 문제 목록에 반영됩니다.',
      ].join('\n'),
    }),
  });

  return { url: pr.html_url, number: pr.number, branch: branchName, id };
}

module.exports = { suggestProblem, isConfigured };
