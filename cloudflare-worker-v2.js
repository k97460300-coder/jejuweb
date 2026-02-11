/**
 * Cloudflare Worker: HLS Proxy & Rewriter (v2)
 * -------------------------------------------
 * 이 코드는 m3u8 파일을 분석하여 내부의 상대 경로와 절대 경로를 모두
 * 현재 프록시 서버를 통해 전달되도록 재작성(Rewriting)합니다.
 * 이를 통해 HTTPS 사이트에서 HTTP 스트림의 모든 조각(.ts)을 차단 없이 재생할 수 있습니다.
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
                },
            });

            const contentType = response.headers.get('Content-Type') || '';

            // m3u8 매니페스트 파일인 경우 내용을 수정(Rewriting)함
            if (targetUrl.includes('.m3u8') || contentType.includes('application/vnd.apple.mpegurl') || contentType.includes('audio/mpegurl')) {
                let text = await response.text();
                const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
                const proxyUrl = `${url.origin}${url.pathname}?url=`;

                // m3u8 내의 줄들을 분석하여 URL 부분을 프록시 주소로 교체
                const lines = text.split('\n');
                const rewrittenLines = lines.map(line => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || trimmedLine.startsWith('#')) {
                        return line; // 주석이나 태그는 그대로 유지
                    }

                    // 절대 경로인 경우
                    if (trimmedLine.startsWith('http')) {
                        return `${proxyUrl}${encodeURIComponent(trimmedLine)}`;
                    }

                    // 상대 경로인 경우 (도메인 루트 기준)
                    if (trimmedLine.startsWith('/')) {
                        const origin = new URL(targetUrl).origin;
                        return `${proxyUrl}${encodeURIComponent(origin + trimmedLine)}`;
                    }

                    // 상대 경로인 경우 (현재 경로 기준)
                    return `${proxyUrl}${encodeURIComponent(baseUrl + trimmedLine)}`;
                });

                const newResponse = new Response(rewrittenLines.join('\n'), response);
                setCorsHeaders(newResponse.headers);
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

function setCorsHeaders(headers) {
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', '*');
}
