// Cloudflare Workers CORS 프록시
// 이 코드를 Cloudflare Workers에 배포하세요

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 프록시할 URL 추출
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return new Response('Missing url parameter', { status: 400 });
        }

        try {
            // 원본 요청
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: request.headers,
            });

            // 응답 복사
            const newResponse = new Response(response.body, response);

            // CORS 헤더 추가
            newResponse.headers.set('Access-Control-Allow-Origin', '*');
            newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            newResponse.headers.set('Access-Control-Allow-Headers', '*');

            return newResponse;
        } catch (error) {
            return new Response(`Proxy error: ${error.message}`, { status: 500 });
        }
    },
};
