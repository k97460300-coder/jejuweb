/**
 * Cloudflare Worker CCTV Proxy v10 (Bot Bypass)
 * --------------------------------------------
 * 1. Aggressive User-Agent & Browser Header Spoofing (봇 감지 우회)
 * 2. M3U8 리라이팅 (상대경로 완벽 지원)
 * 3. 디버그 헤더 추가 (X-Proxy-Original-Status, Content-Type)
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        // 1. 기본 응답 및 사전 검사
        if (!targetUrl) {
            if (url.pathname === '/favicon.ico') return new Response(null, { status: 204 });
            return new Response('Worker Proxy v10 (Bot Bypass) is active.', {
                status: 200,
                headers: { 'Access-Control-Allow-Origin': '*' }
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

        // 2. 대상 서버 요청 함수 (브라우저 완벽 위장)
        async function fetchTarget(attempt = 1) {
            const headers = new Headers();
            const targetHost = targetObj.hostname;

            // 타겟 서버별 맞춤형 Referer 설정
            let referer = 'https://www.jeju.go.kr/';
            if (targetHost.includes('211.114.96.121')) {
                referer = 'https://www.jejusi.go.kr/';
            } else if (targetHost.includes('119.65.216.155') || targetHost.includes('123.140.197.51')) {
                referer = 'https://www.jeju.go.kr/';
            } else if (targetHost.includes('cctv.jejudoin.co.kr') || targetHost.includes('trendworld.kr')) {
                referer = 'https://cctv.jejudoin.co.kr/';
            }

            // 고정된 데스크톱 User-Agent로 일관성 유지 (봇 감지 회피 핵심)
            headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            headers.set('Referer', referer);
            headers.set('Connection', 'keep-alive');

            try {
                const response = await fetch(targetUrl, {
                    headers: headers,
                    method: request.method,
                    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.clone().blob() : null,
                    redirect: 'follow'
                });

                // 403 Forbidden 시도 횟수에 따라 재시도 (최대 2회)
                if (response.status === 403 && attempt < 2) {
                    console.log(`[v10] 403 detected at ${targetHost}. Retrying with alternate UA...`);
                    const altHeaders = new Headers(headers);
                    altHeaders.set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
                    return await fetch(targetUrl, { headers: altHeaders });
                }

                return response;
            } catch (err) {
                throw err;
            }
        }

        try {
            let response = await fetchTarget(1);
            const originalContentType = response.headers.get('Content-Type') || '';

            // 3. M3U8 플레이리스트인 경우 내용물 리라이팅
            if (isM3U8 && response.ok) {
                let text = await response.text();

                // 만약 응답이 HTML 코드이면 (봇 감지됨) 에러 반환
                if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
                    return new Response('Proxy Error: Target returned HTML instead of M3U8 (Bot Protection).', {
                        status: 403,
                        headers: { 'Access-Control-Allow-Origin': '*', 'X-Proxy-Debug': 'html-detected' }
                    });
                }

                const lastSlash = targetUrl.lastIndexOf('/');
                const baseUrl = targetUrl.substring(0, lastSlash + 1);
                const proxyPrefix = `${url.origin}/?url=`;

                const rewrittenText = text.split('\n').map(line => {
                    let processedLine = line;
                    if (processedLine.includes('URI=\"')) {
                        processedLine = processedLine.replace(/URI=\"([^\"]+)\"/g, (match, p1) => {
                            const absUrl = makeAbsolute(p1, baseUrl, targetUrl);
                            return `URI=\"${proxyPrefix}${encodeURIComponent(absUrl)}\"`;
                        });
                    }
                    const trimmed = processedLine.trim();
                    if (!trimmed || trimmed.startsWith('#')) return processedLine;
                    const absUrl = makeAbsolute(trimmed, baseUrl, targetUrl);
                    return `${proxyPrefix}${encodeURIComponent(absUrl)}`;
                }).join('\n');

                return new Response(rewrittenText, {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'X-Proxy-Status': 'v10-active',
                        'X-Original-Content-Type': originalContentType,
                        'Cache-Control': 'no-cache'
                    }
                });
            }

            // 4. 일반 리소스 응답
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('X-Proxy-Status', 'v10-passthrough');
            newResponse.headers.set('X-Original-Content-Type', originalContentType);

            // 보안 헤더 제거
            newResponse.headers.delete('X-Frame-Options');
            newResponse.headers.delete('Content-Security-Policy');

            return newResponse;

        } catch (e) {
            return new Response(`Proxy Error: ${e.message}`, {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
};

function makeAbsolute(url, baseUrl, targetUrl) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
        const origin = new URL(targetUrl).origin;
        return origin + url;
    }
    return baseUrl + url;
}
