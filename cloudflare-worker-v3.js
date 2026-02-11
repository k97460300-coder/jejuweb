/**
 * Cloudflare Worker: HLS Proxy & Rewriter (v3 - Robust)
 * ----------------------------------------------------
 * 이 코드는 m3u8 파일의 모든 줄과 태그(URI=...)를 분석하여 
 * 내부의 모든 경로를 프록시 서버를 통해 전달되도록 재작성합니다.
 */

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return new Response('Missing url parameter', { status: 400 });
        }

        try {
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0',
                    'Referer': new URL(targetUrl).origin,
                },
            });

            const contentType = response.headers.get('Content-Type') || '';
            const isM3U8 = targetUrl.includes('.m3u8') ||
                contentType.includes('application/vnd.apple.mpegurl') ||
                contentType.includes('audio/mpegurl') ||
                contentType.includes('application/x-mpegurl');

            if (isM3U8) {
                let text = await response.text();
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                const proxyUrl = `${url.origin}${url.pathname}?url=`;

                const lines = text.split('\n');
                const rewrittenLines = lines.map(line => {
                    let processedLine = line;

                    // 1. 태그 내의 URI="..." 패턴 처리 (마스터 플레이리스트 대응)
                    if (processedLine.includes('URI="')) {
                        processedLine = processedLine.replace(/URI="([^"]+)"/g, (match, p1) => {
                            const absoluteAttrUrl = makeAbsolute(p1, baseUrl, targetUrl);
                            return `URI="${proxyUrl}${encodeURIComponent(absoluteAttrUrl)}"`;
                        });
                    }

                    const trimmedLine = processedLine.trim();
                    if (!trimmedLine || trimmedLine.startsWith('#')) {
                        return processedLine;
                    }

                    // 2. 일반적인 경로 라인 처리 (세그먼트 또는 하위 플레이리스트)
                    const absoluteLineUrl = makeAbsolute(trimmedLine, baseUrl, targetUrl);
                    return `${proxyUrl}${encodeURIComponent(absoluteLineUrl)}`;
                });

                const newResponse = new Response(rewrittenLines.join('\n'), response);
                setCorsHeaders(newResponse.headers);
                newResponse.headers.set('Content-Type', 'application/vnd.apple.mpegurl');
                return newResponse;
            }

            // 그 외 파일(.ts 등)은 그대로 스트리밍
            const newResponse = new Response(response.body, response);
            setCorsHeaders(newResponse.headers);
            return newResponse;

        } catch (error) {
            return new Response(`Proxy error: ${error.message}`, { status: 500 });
        }
    },
};

function makeAbsolute(url, baseUrl, targetUrl) {
    if (url.startsWith('http')) return url;
    if (url.startsWith('/')) {
        const origin = new URL(targetUrl).origin;
        return origin + url;
    }
    return baseUrl + url;
}

function setCorsHeaders(headers) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
}
