/**
 * Cloudflare Worker: HLS Proxy & Rewriter (v5 - Final Transparency)
 * ----------------------------------------------------------------
 * - 403 Forbidden 방지를 위해 요청 헤더 최적화 (Referer 제거)
 * - OPTIONS 사전 검사 완벽 지원
 * - M3U8 내부 모든 경로 리라이팅
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. OPTIONS 사전 검사 처리
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
            return new Response('Missing url parameter', { status: 400 });
        }

        try {
            // 타겟 서버 요청 (403 방지를 위해 헤더 최소화)
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                },
            });

            const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
            const isM3U8 = targetUrl.includes('.m3u8') ||
                contentType.includes('mpegurl') ||
                contentType.includes('x-mpegurl');

            // 2. M3U8 리라이팅
            if (isM3U8) {
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

                const newResponse = new Response(rewrittenText, {
                    status: response.status,
                    headers: {
                        'Content-Type': 'application/vnd.apple.mpegurl',
                        'Access-Control-Allow-Origin': '*',
                    }
                });
                return newResponse;
            }

            // 3. 일반 파일 스트리밍
            const newResponse = new Response(response.body, response);
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
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
