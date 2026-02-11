/**
 * Cloudflare Worker: HLS Proxy & Rewriter (v4 - Final Ultimate)
 * -----------------------------------------------------------
 * - OPTIONS 프리플라이트 요청 처리 추가 (PC 브라우저 필수)
 * - 모든 응답에 강력한 CORS 헤더 적용
 * - 마스터 및 베리언트 플레이리스트의 모든 URL(URI=...) 프록시화
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. OPTIONS 사전 검사(Preflight) 요청 즉시 처리
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
            // 원본 데이터 요청
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': new URL(targetUrl).origin,
                },
            });

            const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
            const isM3U8 = targetUrl.includes('.m3u8') ||
                contentType.includes('mpegurl') ||
                contentType.includes('x-mpegurl');

            // 2. M3U8 매니페스트 리라이팅 (모든 경로를 프록시 주소로 변환)
            if (isM3U8) {
                let text = await response.text();
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                const proxyUrl = `${url.origin}${url.pathname}?url=`;

                const rewrittenText = text.split('\n').map(line => {
                    let processedLine = line;

                    // URI="..." 태그 처리
                    if (processedLine.includes('URI="')) {
                        processedLine = processedLine.replace(/URI="([^"]+)"/g, (match, p1) => {
                            const absUrl = makeAbsolute(p1, baseUrl, targetUrl);
                            return `URI="${proxyUrl}${encodeURIComponent(absUrl)}"`;
                        });
                    }

                    const trimmed = processedLine.trim();
                    if (!trimmed || trimmed.startsWith('#')) return processedLine;

                    // 일반 파일 경로 처리
                    const absUrl = makeAbsolute(trimmed, baseUrl, targetUrl);
                    return `${proxyUrl}${encodeURIComponent(absUrl)}`;
                }).join('\n');

                const newResponse = new Response(rewrittenText, {
                    status: response.status,
                    headers: { 'Content-Type': 'application/vnd.apple.mpegurl' }
                });
                applyCors(newResponse.headers);
                return newResponse;
            }

            // 3. 비디오 조각(.ts 등) 스트리밍
            const newResponse = new Response(response.body, response);
            applyCors(newResponse.headers);
            return newResponse;

        } catch (error) {
            const errRes = new Response(`Proxy error: ${error.message}`, { status: 500 });
            applyCors(errRes.headers);
            return errRes;
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

function applyCors(headers) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Expose-Headers', '*');
}
