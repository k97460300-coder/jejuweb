# Cloudflare Pages + Workers 배포 가이드 (수정)

## ⚠️ 중요: Workers는 Git 연결 사용 안 함!

Workers를 Git 리포지토리에 직접 연결하면 빌드가 실패합니다.
대신 **수동 배포** 또는 **Wrangler CLI**를 사용하세요.

---

## 방법 1: 수동 배포 (가장 간단)

### 1단계: Cloudflare Pages 배포

1. **Cloudflare 대시보드**: https://dash.cloudflare.com
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 저장소 선택: `k97460300-coder/jejuweb`
4. **Build settings:**
   - Project name: `jejuweb`
   - Production branch: `main`
   - Framework preset: `None`
   - Build command: (비워두기)
   - Build output directory: `/`
5. **Save and Deploy**
6. 배포 완료! URL: `https://jejuweb.pages.dev`

### 2단계: Workers 프록시 배포 (수동)

1. **Workers & Pages** → **Create** → **Create Worker**
2. Worker 이름: `cors-proxy`
3. **Deploy** 클릭
4. **Edit code** 클릭
5. 기존 코드를 모두 삭제하고 `cloudflare-worker.js` 내용 붙여넣기:

```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return new Response('Missing url parameter', { status: 400 });
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: request.headers,
      });

      const newResponse = new Response(response.body, response);
      newResponse.headers.set('Access-Control-Allow-Origin', '*');
      newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      newResponse.headers.set('Access-Control-Allow-Headers', '*');

      return newResponse;
    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, { status: 500 });
    }
  },
};
```

6. **Save and Deploy** 클릭
7. Worker URL 복사: `https://cors-proxy.k97460300.workers.dev`

### 3단계: script.js 수정

Worker URL을 사용하도록 수정:

```javascript
// Worker URL 설정
const WORKER_URL = 'https://cors-proxy.k97460300.workers.dev';

// 도착 항공편
const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(arrUrl)}`;

// 출발 항공편
const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(depUrl)}`;

// 한라산
const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
```

### 4단계: GitHub 푸시

수정된 `script.js`를 푸시하면 Cloudflare Pages가 자동 재배포!

---

## 방법 2: Wrangler CLI (고급)

로컬에서 배포하려면:

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

---

## 완료!

✅ Pages: `https://jejuweb.pages.dev`
✅ Worker: `https://cors-proxy.k97460300.workers.dev`
