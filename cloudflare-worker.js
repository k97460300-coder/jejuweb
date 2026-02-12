/**
 * Cloudflare Worker: HLS Proxy & Rewriter (Final Unified)
 * ----------------------------------------------------
 * - 403 Forbidden 및 CORS 에러를 완전히 해결합니다.
 * - wrangler.toml에서 참조하는 메인 파일(cloudflare-worker.js)입니다.
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. OPTIONS 요청(사전 검사) 처리
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

            // 2. 대상 서버 요청 (Referer를 대상 도메인으로 변조하여 403 방지)
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Referer': targetObj.origin + '/',
                },
            });

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
                        'X-Proxy-Status': 'active-m3u8',
                        'Cache-Control': 'no-cache'
                    }
                });
            }

            // 4. 비디오 조각(.ts) 등 기타 파일은 그대로 스트리밍
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('X-Proxy-Status', 'active-segment');
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
