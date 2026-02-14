# 🏝️ 济州岛旅游信息助手 (Jeju Travel Assistant)

这是一个为前往济州岛旅游的游客提供实时信息的 Web 应用程序。它集成了天气、CCTV 监控、汉拿山状态及机场航班等核心功能。

---

## ✨ 核心功能

### 1. 📹 实时 CCTV 监控 (CCTV Streaming)
*   **하이브리드 재생 (Hybrid Playback)**: 
    *   성산일출봉, 한라산 등 주요 명소는 **YouTube Live**를 직접 연동하여 최상의 화질과 안정성을 제공합니다.
    *   그 외 지역은 **IP 기반 HLS 스트리밍**을 사용합니다.
*   **어댑티브 로직 (Adaptive Fetching)**: 
    *   **직결 우선(Direct-First)**: 브라우저가 CCTV 서버에 직접 연결을 시도하여 빠른 속도를 보장합니다.
    *   **프록시 백업(Proxy Fallback)**: 직접 연결이 실패할 경우 Cloudflare Worker 프록시를 통해 우회 재생을 시도합니다.
*   **UX 최적화**: 2x2 격자 레이아웃 제공 및 클릭 시 전체 화면 모달 지원.

### 2. 🌤️ 实时天气预报 (Weather Forecast)
*   **다지역 정보**: 제주시, 서귀포시, 한라산(1100고지), 우도 4개 거점별 날씨.
*   **상세 예보**: 
    *   현재 날씨 (기온, 풍속, 강수량).
    *   오늘의 시간별 예보 (09:00 ~ 22:00).
    *   향후 10일간의 중기 예보.

### 3. ⛰️ 汉拿山登山状态 (Hallasan Trail Status)
*   **실시간 통제 정보**: 어리목, 영실, 성판악 등 7개 주요 코스의 입산 통제 상황 실시간 표시.
*   **글로벌 대응**: 코스별 명칭을 한국어/중국어/영어로 병기하여 가독성 향상.

### 4. ✈️ 济州机场航班信息 (Jeju Airport Flights)
*   **국제선 중심**: 국제선 도착/출발 항공편 실시간 리스트.
*   **상태 강조**: 결항(Cancel) 및 지연(Delay) 항공편을 시각적으로 강조하여 정보 인지 속도 향상.

---

## 🛠️ 技术细节 (Technical Implementation)

*   **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism UI), JavaScript (ES6+).
*   **Streaming**: `Hls.js` 라이브러리를 사용한 HLS 스트리밍 구현.
*   **Proxy System**: Cloudflare Workers를 사용한 CORS 및 403 Forbidden 우회 프록시 구축.
*   **Data Aggregation**: 
    *   기상청 공공데이터 API (날씨).
    *   공항 실시간 운항 정보 API (항공).
    *   제주특별자치도청 데이터 크롤링 (한라산 상태).
    *   [제주도인 CCTV](https://cctv.jejudoin.co.kr/) (실시간 영상 소스).

---

## 🚀 运行与开发

### CORS 해결 (로컬 실행 시 필수)
브라우저 보안 정책상 API 데이터를 원활하게 로드하기 위해 로컬 서버 환경이 필요합니다.

1.  **Python 사용 (추천)**:
    ```bash
    # start_server.bat 실행 또는 터미널에서 입력
    python -m http.server 8000
    ```
2.  **접속**: `http://localhost:8000`

---

## 📂 파일 구조
*   `index.html`: 메인 웹 페이지 구조 및 SEO 최적화.
*   `style.css`: Modern Premium Soft 테마 및 반응형 디자인.
*   `script.js`: 모든 API 연동 및 비즈니스 로직.
*   `cloudflare-worker.js`: 백엔드 프록시 로직.

---

## 📝 업데이트 내역
*   **v1.6**: 실시간 해변(삼양, 함덕, 협재) 및 성산일출봉 CCTV 주소 최신화.
*   **v1.5**: 한라산 코스명 영문 병기 및 CCTV 직결 우선 로직 적용.
*   **v1.4**: 성산일출봉 등 주요 거점 YouTube Live 하이브리드 재생 도입.
*   **v1.3**: 2x2 CCTV 격자 레이아웃 및 모바일 반응형 디자인 최적화.
