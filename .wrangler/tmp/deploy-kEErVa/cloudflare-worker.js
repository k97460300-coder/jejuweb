/**
 * Cloudflare Worker CCTV Proxy v9 (Ultra Robust)
 * --------------------------------------------
 * 1. 403 에러 발생 시 3단계 재시도 로직 (정밀 -> 최소 -> 무적)
 * 2. M3U8 플레이리스트 리라이팅 (상세 상대경로 처리)
 * 3. 강력한 CORS 헤더 및 불필요한 보안 헤더 제거
 * 4. 파비콘 에러 방지
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        // 1. 기본 응답 및 사전 검사
        if (!targetUrl) {
            if (url.pathname === '/favicon.ico') {
                return new Response(null, { status: 204 });
            }
            return new Response('Cloudflare Worker Proxy v9 is running.\nUsage: /?url=TARGET_URL', {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=UTF-8',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }

        // OPTIONS 사전 요청 처리
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                    'Access-Control-Max-Age': '86400',
                },
            });
        }

        const targetObj = new URL(targetUrl);
        const isM3U8 = targetUrl.toLowerCase().includes('.m3u8');

        // 2. 대상 서버 요청 함수 (단계별 재시도)
        async function fetchWithRetry(attempt = 1) {
            const headers = new Headers();

            if (attempt === 1) {
                // 1단계: 표준 브라우저 헤더 + Referer spoofing
                headers.set('User-Agent', request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                headers.set('Accept', '*/*');
                headers.set('Referer', targetObj.origin + '/');
                headers.set('Origin', targetObj.origin);
            } else if (attempt === 2) {
                // 2단계: 최소 헤더 (Wowza 등 차단 우회용)
                headers.set('User-Agent', 'Mozilla/5.0');
                headers.set('Accept', '*/*');
            } else {
                // 3단계: 헤더 없음 (최후의 수단)
            }

            try {
                const response = await fetch(targetUrl, {
                    headers: headers,
                    redirect: 'follow'
                });

                // 403 Forbidden 시도 횟수에 따라 재시도
                if (response.status === 403 && attempt < 3) {
                    console.log(`[Proxy] 403 for ${targetUrl}. Attempting retry #${attempt + 1}...`);
                    return await fetchWithRetry(attempt + 1);
                }

                return response;
            } catch (err) {
                if (attempt < 3) return await fetchWithRetry(attempt + 1);
                throw err;
            }
        }

        try {
            let response = await fetchWithRetry(1);

            // 3. M3U8 플레이리스트인 경우 내용물 리라이팅
            if (isM3U8 && response.ok) {
                let text = await response.text();
                const lastSlash = targetUrl.lastIndexOf('/');
                const baseUrl = targetUrl.substring(0, lastSlash + 1);
                const proxyPrefix = `${url.origin}/?url=`;

                const rewrittenText = text.split('\n').map(line => {
                    let processedLine = line;
                    // URI 세그먼트 처리 (EXT-X-KEY 등)
                    if (processedLine.includes('URI=\"')) {
                        processedLine = processedLine.replace(/URI=\"([^\"]+)\"/g, (match, p1) => {
                            const absUrl = makeAbsolute(p1, baseUrl, targetUrl);
                            return `URI=\"${proxyPrefix}${encodeURIComponent(absUrl)}\"`;
                        });
                    }

                    const trimmed = processedLine.trim();
                    if (!trimmed || trimmed.startsWith('#')) return processedLine;

                    // 일반 세그먼트 URL 처리
                    const absUrl = makeAbsolute(trimmed, baseUrl, targetUrl);
                    return `${proxyPrefix}${encodeURIComponent(absUrl)}`;
                }).join('\n');

                return new Response(rewrittenText, {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'X-Proxy-Status': 'v9-m3u8',
                        'Cache-Control': 'no-cache'
                    }
                });
            }

            // 4. TS 세그먼트 및 기타 리소스 응답
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('X-Proxy-Status', 'v9-passthrough');

            // 대상 서버의 보안 정책 헤더가 프록시 응답을 방해하지 않도록 제거
            newResponse.headers.delete('X-Frame-Options');
            newResponse.headers.delete('Content-Security-Policy');
            newResponse.headers.delete('X-Content-Type-Options');

            return newResponse;

        } catch (e) {
            return new Response(`Proxy Error: ${e.message}`, {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
};

// 상대 경로를 절대 경로로 바꾸는 유틸리티
function makeAbsolute(url, baseUrl, targetUrl) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
        const origin = new URL(targetUrl).origin;
        return origin + url;
    }
    return baseUrl + url;
}
