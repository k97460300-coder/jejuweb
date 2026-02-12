/**
 * Cloudflare Worker: HLS Proxy & Rewriter (Ultra Robust V8)
 * --------------------------------------------------------
 * - 403 Forbidden 해결을 위해 멀티플 헤더 시도 (Wowza 등 특수 서버 대응)
 * - wrangler.toml 설정과 일치하도록 jejuweb 이름 사용
 * - 모든 응답에 강력한 CORS 헤더 및 캐시 제어 적용
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. OPTIONS 사전 검사(Preflight) 처리
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

        const targetUrl = url.searchParams.get('url');
        if (!targetUrl) {
            return new Response('Missing url parameter', {
                status: 400,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        try {
            const targetObj = new URL(targetUrl);

            // 2. 대상 서버 요청 전략 (멀티 시도)
            let response;

            // 전략 1: 표준 헤더 + Referer 변조 (가장 일반적인 해결책)
            response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': targetObj.origin + '/',
                },
            });

            // 전략 2: 만약 403이 발생하면, 헤더를 최소화하여 재시도 (Wowza 특성 고려)
            if (response.status === 403) {
                console.log(`[Proxy] 403 detected for ${targetUrl}, retrying with minimal headers...`);
                response = await fetch(targetUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    },
                });
            }

            const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
            const isM3U8 = targetUrl.includes('.m3u8') ||
                contentType.includes('mpegurl') ||
                contentType.includes('x-mpegurl');

            // 3. M3U8 플레이리스트인 경우 리라이팅
            if (isM3U8 && response.ok) {
                let text = await response.text();
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                const proxyUrl = `${url.origin}${url.pathname}?url=`;

                const rewrittenText = text.split('\n').map(line => {
                    let processedLine = line;
                    if (processedLine.includes('URI="')) {
                        processedLine = processedLine.replace(/URI="([^"]+)"/g, (match, p1) => {
                            const absUrl = makeAbsolute(p1, baseUrl, targetUrl);
                            return `URI="${proxyUrl}${encodeURIComponent(absUrl)}"`;
                        });
                    }
                    const trimmed = processedLine.trim();
                    if (!trimmed || trimmed.startsWith('#')) return processedLine;
                    const absUrl = makeAbsolute(trimmed, baseUrl, targetUrl);
                    return `${proxyUrl}${encodeURIComponent(absUrl)}`;
                }).join('\n');

                return new Response(rewrittenText, {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                        'X-Proxy-Status': 'active-m3u8-v8',
                        'Cache-Control': 'no-cache'
                    }
                });
            }

            // 4. 기타 파일(.ts) 스트리밍
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('X-Proxy-Status', 'active-segment-v8');
            return newResponse;

        } catch (error) {
            return new Response(`Proxy error: ${error.message}`, {
                status: 500,
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }
    },
};

function makeAbsolute(url, baseUrl, targetUrl) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    if (url.startsWith('/')) {
        const origin = new URL(targetUrl).origin;
        return origin + url;
    }
    return baseUrl + url;
}
