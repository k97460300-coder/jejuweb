// API 키
const API_KEY = '05988a053767a7a6cc5553d077ce7ea541c60806a0160d5ac2e9119ebe5a61ce';

// 4개 주요 관광지 좌표
const LOCATIONS = {
    jeju: { name: '济州市', nx: 52, ny: 38 },
    seogwipo: { name: '西归浦市', nx: 52, ny: 33 },
    hallasan: { name: '汉拿山', nx: 52, ny: 38 },  // 1100고지
    udo: { name: '牛岛', nx: 56, ny: 43 }
};

// 날짜 관련 함수
function getFormatDate(date) {
    const y = date.getFullYear();
    const m = ('0' + (date.getMonth() + 1)).slice(-2);
    const d = ('0' + date.getDate()).slice(-2);
    return y + '' + m + '' + d;
}

function log(msg) {
    if (typeof msg === 'object') {
        console.log(JSON.stringify(msg, null, 2));
    } else {
        console.log(msg);
    }
}

// 날씨 아이콘 결정 함수
function getWeatherIcon(pty, sky, hour) {
    let icon = '☀️';
    if (pty > 0) {
        icon = (pty === 3) ? '❄️' : '🌧️';
    } else if (sky > 8) {
        icon = '☁️';
    } else if (sky > 5) {
        icon = '⛅';
    }
    if (hour >= 19 && (icon === '☀️' || icon === '⛅')) {
        icon = '🌙';
    }
    return icon;
}

// 날씨 설명 (중국어)
function getWeatherDesc(pty, sky) {
    if (pty > 0) return (pty === 3) ? '下雪' : '下雨';
    if (sky > 8) return '阴天';
    if (sky > 5) return '多云';
    return '晴朗';
}

// 특정 지역의 날씨 데이터 로드
async function loadWeatherForLocation(locationKey) {
    const location = LOCATIONS[locationKey];
    const now = new Date();
    const yyyy = now.getFullYear();
    const todayStr = getFormatDate(now);

    let baseDate = todayStr;
    let baseTime = "0200";
    if (now.getHours() < 3) {
        const yD = new Date(yyyy, now.getMonth(), now.getDate() - 1);
        baseDate = getFormatDate(yD);
        baseTime = "2300";
    }

    try {
        const url = `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${API_KEY}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${location.nx}&ny=${location.ny}`;
        const res = await fetch(url);
        const json = await res.json();

        if (json.response && json.response.header.resultCode === '00') {
            const hourly = {};
            const tempDays = {};

            json.response.body.items.item.forEach(i => {
                const date = i.fcstDate;
                const h = parseInt(i.fcstTime.slice(0, 2));

                // 시간대별 데이터
                if (date === todayStr && h >= 9 && h <= 22) {
                    if (!hourly[h]) hourly[h] = {};
                    hourly[h][i.category] = i.fcstValue;
                }

                // 주간 데이터
                if (!tempDays[date]) tempDays[date] = { min: 100, max: -100, temps: [], hourlyData: Array(24).fill(null).map(() => ({})) };
                if (i.category === 'TMN') tempDays[date].min = parseFloat(i.fcstValue);
                if (i.category === 'TMX') tempDays[date].max = parseFloat(i.fcstValue);
                if (i.category === 'TMP') tempDays[date].temps.push(parseFloat(i.fcstValue));
                tempDays[date].hourlyData[h][i.category] = i.fcstValue;
            });

            // 현재 날씨 업데이트
            updateCurrentWeather(locationKey, hourly, now.getHours());

            // 시간대별 날씨 업데이트
            updateHourlyWeather(locationKey, hourly);

            // 주간 날씨 업데이트
            updateWeeklyWeather(locationKey, tempDays, now);

            log(`${location.name} 날씨 데이터 로드 완료`);
        }
    } catch (e) {
        log(`${location.name} 날씨 API 오류: ` + e.message);
    }
}

// 현재 날씨 업데이트
function updateCurrentWeather(locationKey, hourly, currentHour) {
    const currentData = hourly[currentHour] || hourly[currentHour - 1] || {};
    const weatherDiv = document.querySelector(`#weather-${locationKey}`);

    if (weatherDiv && currentData.TMP) {
        const tempValue = weatherDiv.querySelector('.temp-value');
        const weatherIcon = weatherDiv.querySelector('.weather-icon');
        const weatherDesc = weatherDiv.querySelector('.weather-desc');
        const detailValues = weatherDiv.querySelectorAll('.detail-value');

        if (tempValue) tempValue.textContent = currentData.TMP;
        if (weatherIcon) weatherIcon.textContent = getWeatherIcon(parseInt(currentData.PTY || 0), parseInt(currentData.SKY || 1), currentHour);
        if (weatherDesc) weatherDesc.textContent = getWeatherDesc(parseInt(currentData.PTY || 0), parseInt(currentData.SKY || 1));

        if (detailValues.length >= 2) {
            if (currentData.REH) detailValues[0].textContent = currentData.REH + '%';
            if (currentData.WSD) detailValues[1].textContent = currentData.WSD + ' m/s';
        }
    }
}

// 시간대별 날씨 업데이트
function updateHourlyWeather(locationKey, hourly) {
    const hourlyScroll = document.querySelector(`#hourly-${locationKey}`);
    if (!hourlyScroll) return;

    let html = '';
    for (let h = 9; h <= 22; h++) {
        const d = hourly[h] || {};
        const icon = getWeatherIcon(parseInt(d.PTY || 0), parseInt(d.SKY || 1), h);

        let pcp = d.PCP || '0';
        if (pcp === "강수없음") pcp = "0mm";
        else if (pcp.includes("미만")) pcp = "~1mm";
        else if (!pcp.endsWith("mm")) pcp += "mm";

        const precipClass = pcp !== '0mm' ? 'precip-blue' : '';

        html += `
            <div class="hourly-item">
                <div class="hourly-time">${h}h</div>
                <div class="hourly-icon">${icon}</div>
                <div class="hourly-temp">${d.TMP || '-'}°</div>
                <div class="hourly-wind">${d.WSD || '-'}m/s</div>
                <div class="hourly-precip ${precipClass}">${pcp}</div>
            </div>`;
    }
    hourlyScroll.innerHTML = html;
}

// 주간 날씨 업데이트
async function updateWeeklyWeather(locationKey, tempDays, now) {
    const weeklyGrid = document.querySelector(`#weekly-${locationKey}`);
    if (!weeklyGrid) return;

    const yyyy = now.getFullYear();
    const dayNames = ['今天', '周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    // 중기예보 데이터 가져오기 (3~9일)
    const midTermData = await fetchMidTermForecast(locationKey);

    let html = '';

    for (let i = 0; i <= 9; i++) {
        const d = new Date(yyyy, now.getMonth(), now.getDate() + i);
        const dStr = getFormatDate(d);
        const dayName = i === 0 ? dayNames[0] : dayNames[d.getDay()];

        let icon = '☀️';
        let minT = '-';
        let maxT = '-';
        let maxPop = 0;

        if (i <= 2) {
            // 단기예보 데이터 사용 (0~2일)
            const t = tempDays[dStr];
            if (t) {
                if (t.min === 100 && t.temps.length > 0) t.min = Math.min(...t.temps);
                if (t.max === -100 && t.temps.length > 0) t.max = Math.max(...t.temps);

                let weatherCounts = {};
                for (let h = 9; h <= 22; h++) {
                    const hourData = t.hourlyData[h] || {};
                    const pty = parseInt(hourData.PTY || 0);
                    const sky = parseInt(hourData.SKY || 1);
                    const pop = parseInt(hourData.POP || 0);
                    if (pop > maxPop) maxPop = pop;

                    let weatherKey = '맑음';
                    if (pty > 0) {
                        weatherKey = (pty === 3) ? '눈' : '비';
                    } else {
                        if (sky === 4) weatherKey = '흐림';
                        else if (sky === 3) weatherKey = '구름많음';
                    }
                    weatherCounts[weatherKey] = (weatherCounts[weatherKey] || 0) + 1;
                }

                let dominantWeather = '맑음';
                let maxCount = 0;
                for (const weather in weatherCounts) {
                    if (weatherCounts[weather] > maxCount) {
                        maxCount = weatherCounts[weather];
                        dominantWeather = weather;
                    }
                }

                if (dominantWeather.includes('흐림')) icon = '☁️';
                else if (dominantWeather.includes('구름') || dominantWeather.includes('많음')) icon = '⛅';
                else if (dominantWeather.includes('비')) icon = '🌧️';
                else if (dominantWeather.includes('눈')) icon = '❄️';

                minT = (t.min !== undefined && t.min !== 100) ? Math.round(t.min) : '-';
                maxT = (t.max !== undefined && t.max !== -100) ? Math.round(t.max) : '-';
            }
        } else {
            // 중기예보 데이터 사용 (3~9일)
            const midDay = midTermData[i - 3];
            if (midDay) {
                icon = midDay.icon;
                minT = midDay.minTemp;
                maxT = midDay.maxTemp;
                maxPop = midDay.rainProb;
            }
        }

        const precipClass = maxPop > 50 ? 'precip-blue' : '';

        html += `
            <div class="weekly-item">
                <div class="weekly-day">${dayName}<br><span style="font-size:9px; color:#aaa;">+${i}D</span></div>
                <div class="weekly-icon">${icon}</div>
                <div class="weekly-temps">
                    <span class="temp-high">${maxT}°</span>
                    <span class="temp-low">${minT}°</span>
                </div>
                <div class="weekly-precip ${precipClass}">${maxPop}%</div>
            </div>`;
    }
    weeklyGrid.innerHTML = html;
}

// 중기예보 API 호출 (3~10일)
async function fetchMidTermForecast(locationKey) {
    const now = new Date();
    const baseDate = getFormatDate(now);
    const baseTime = now.getHours() < 18 ? '0600' : '1800';

    // 제주도 지역 코드
    const regId = '11G00201';

    try {
        // 중기기온예보
        const tempUrl = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey=${API_KEY}&numOfRows=10&pageNo=1&dataType=JSON&regId=${regId}&tmFc=${baseDate}${baseTime}`;
        const tempRes = await fetch(tempUrl);
        const tempJson = await tempRes.json();

        // 중기육상예보
        const landUrl = `https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${API_KEY}&numOfRows=10&pageNo=1&dataType=JSON&regId=11G00000&tmFc=${baseDate}${baseTime}`;
        const landRes = await fetch(landUrl);
        const landJson = await landRes.json();

        const result = [];

        if (tempJson.response?.body?.items?.item?.[0] && landJson.response?.body?.items?.item?.[0]) {
            const tempItem = tempJson.response.body.items.item[0];
            const landItem = landJson.response.body.items.item[0];

            // 3~9일 데이터 (총 7일)
            for (let day = 3; day <= 9; day++) {
                const minTemp = tempItem[`taMin${day}`] || '-';
                const maxTemp = tempItem[`taMax${day}`] || '-';

                // 날씨 상태
                let wf = landItem[`wf${day}Am`] || landItem[`wf${day}`] || '';

                // 강수확률
                let rainProb = parseInt(landItem[`rnSt${day}Am`] || landItem[`rnSt${day}`] || 0);

                // 아이콘 결정
                let icon = '☀️';
                if (wf.includes('비') || wf.includes('소나기')) icon = '🌧️';
                else if (wf.includes('눈')) icon = '❄️';
                else if (wf.includes('흐림')) icon = '☁️';
                else if (wf.includes('구름')) icon = '⛅';

                result.push({
                    minTemp: minTemp,
                    maxTemp: maxTemp,
                    icon: icon,
                    rainProb: rainProb
                });
            }
        }

        // API 실패 시 기본값
        while (result.length < 7) {
            result.push({
                minTemp: '-',
                maxTemp: '-',
                icon: '☀️',
                rainProb: 0
            });
        }

        return result;
    } catch (e) {
        log('중기예보 API 오류: ' + e.message);
        // 오류 시 기본값 반환
        return Array(7).fill().map(() => ({
            minTemp: '-',
            maxTemp: '-',
            icon: '☀️',
            rainProb: 0
        }));
    }
}

// 한라산 통제 정보 크롤링
async function initHallasan() {
    const dataUrl = 'https://jeju.go.kr/tool/hallasan/road-body.jsp';
    const proxyBase = 'https://api.allorigins.win/raw?url=';

    try {
        const proxyUrl = proxyBase + encodeURIComponent(dataUrl);
        const res = await fetch(proxyUrl);
        const text = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');

        const trails = [
            { id: '어리목', name: '御里牧路线', sub: 'Eorimok' },
            { id: '영실', name: '灵室路线', sub: 'Yeongsil' },
            { id: '어승생악', name: '御乘生岳路线', sub: 'Eoseungsaengak' },
            { id: '돈내코', name: '敦乃克路线', sub: 'Donnaeko' },
            { id: '석굴암', name: '石窟庵路线', sub: 'Seokgulam' },
            { id: '관음사', name: '观音寺路线', sub: 'Gwaneumsa' },
            { id: '성판악', name: '城板岳路线', sub: 'Seongpanak' }
        ];

        const getStatusCN = (st) => {
            if (st === '정상') return { t: '🟢 正常通行', c: '#4caf50' };
            if (st === '부분') return { t: '🟡 部分管制', c: '#ff9800' };
            if (st === '통제') return { t: '🔴 全面管制', c: '#f44336' };
            return { t: '⚪ 信息未知', c: '#999' };
        };

        const trailsGrid = document.querySelector('.trails-grid');

        if (trailsGrid) {
            let html = '';

            // HTML에서 dl.main-visit-list 요소들을 찾아서 파싱
            const dlElements = doc.querySelectorAll('dl.main-visit-list');

            trails.forEach(t => {
                let st = '정상';  // 기본값
                let statusText = '';

                // 각 dl 요소에서 해당 등산로 찾기
                dlElements.forEach(dl => {
                    const dtElement = dl.querySelector('dt');
                    if (dtElement && dtElement.textContent.includes(t.id)) {
                        // dd.situation 요소에서 상태 확인
                        const situationElement = dl.querySelector('dd.situation');
                        if (situationElement) {
                            statusText = situationElement.textContent.trim();

                            // 상태 판단
                            if (statusText.includes('전면통제') || statusText.includes('통제') || statusText.includes('폐쇄')) {
                                st = '통제';
                            } else if (statusText.includes('부분통제') || statusText.includes('부분관제') || statusText.includes('부분')) {
                                st = '부분';
                            } else if (statusText.includes('정상') || statusText.includes('개방')) {
                                st = '정상';
                            }
                        }
                    }
                });

                const info = getStatusCN(st);

                html += `
                    <div class="trail-card">
                        <div class="trail-header">
                            <h4>${t.name} <span class="trail-subtitle">${t.sub}</span></h4>
                            <span class="trail-status open" style="background: ${info.c}; color: white;">${info.t}</span>
                        </div>
                        <div class="trail-info">
                            <div class="trail-detail">
                                <span class="trail-label">状态：</span>
                                <span class="trail-value">${statusText || (st === '정상' ? '正常开放' : st === '통제' ? '禁止通行' : st === '부분' ? '部分限制' : '确认中')}</span>
                            </div>
                        </div>
                    </div>`;
            });
            trailsGrid.innerHTML = html;
        }

        log('한라산 정보 로드 완료');
    } catch (e) {
        log('한라산 API 오류: ' + e.message);
    }
}

// 공항 운항 정보 API
async function initFlightData() {
    const now = new Date();
    const todayStr = getFormatDate(now);

    const createFlightHTML = (flight, type) => {
        const rmk = flight.rmk || '';
        let statusClass = 'status-ontime';
        let statusText = '准点';

        // 결항 감지 (다양한 표현 포함)
        if (rmk.includes('결항') || rmk.includes('취소') || rmk.includes('CANCELLED') || rmk.includes('CANCELED')) {
            statusClass = 'status-cancelled';
            statusText = '取消';
        }
        // 지연 감지
        else if (rmk.includes('지연') || rmk.includes('DELAYED') || rmk.includes('DELAY')) {
            statusClass = 'status-delayed';
            statusText = '延误';
        }

        const route = type === 'dep' ? flight.arrAirport : flight.depAirport;
        const time = flight.scheduledatetime.slice(-4, -2) + ':' + flight.scheduledatetime.slice(-2);

        return `
            <div class="flight-row">
                <div class="flight-col"><strong>${flight.flightId}</strong></div>
                <div class="flight-col">${route}</div>
                <div class="flight-col">${time}</div>
                <div class="flight-col"><span class="status-badge ${statusClass}">${statusText}</span></div>
            </div>`;
    };

    // 도착 항공편
    try {
        const arrUrl = `http://openapi.airport.co.kr/service/rest/StatusOfFlights/getArrFlightStatusList?serviceKey=${API_KEY}&arr_airport_code=CJU&line=I&searchday=${todayStr}&from_time=0000&to_time=2359&pageNo=1&numOfRows=100`;
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(arrUrl);

        const res = await fetch(proxyUrl);
        const text = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const items = xmlDoc.querySelectorAll("item");
        let allFlights = [];

        items.forEach((item, index) => {
            if (index >= 20) return; // 최대 20개만 표시

            const rmk = item.querySelector("rmk")?.textContent || '';
            const airline = item.querySelector("airlineKorean")?.textContent || item.querySelector("airline")?.textContent || '';

            allFlights.push({
                airline: airline,
                flightId: item.querySelector("flightid")?.textContent || '',
                depAirport: item.querySelector("depAirport")?.textContent || '',
                arrAirport: item.querySelector("arrAirport")?.textContent || '',
                scheduledatetime: item.querySelector("scheduledatetime")?.textContent || '',
                rmk: rmk
            });
        });

        const arrivalsContent = document.getElementById('arrivals');
        if (arrivalsContent) {
            const flightTable = arrivalsContent.querySelector('.flight-table');
            if (flightTable && allFlights.length > 0) {
                let html = `
                    <div class="flight-row flight-header">
                        <div class="flight-col">航班号</div>
                        <div class="flight-col">出发地</div>
                        <div class="flight-col">计划时间</div>
                        <div class="flight-col">状态</div>
                    </div>`;
                allFlights.forEach(f => html += createFlightHTML(f, 'arr'));
                flightTable.innerHTML = html;
            } else if (flightTable && allFlights.length === 0) {
                flightTable.innerHTML = `
                    <div class="flight-row flight-header">
                        <div class="flight-col">航班号</div>
                        <div class="flight-col">出发地</div>
                        <div class="flight-col">计划时间</div>
                        <div class="flight-col">状态</div>
                    </div>
                    <div style="padding:40px; text-align:center; color:#999;">暂无到达航班信息</div>`;
            }
        }

        log('도착 항공편 데이터 로드 완료');
    } catch (e) {
        log('도착 항공편 API 오류: ' + e.message);
    }

    // 출발 항공편
    try {
        const depUrl = `http://openapi.airport.co.kr/service/rest/StatusOfFlights/getDepFlightStatusList?serviceKey=${API_KEY}&airport_code=CJU&line=I&searchday=${todayStr}&from_time=0000&to_time=2359&pageNo=1&numOfRows=100`;
        const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(depUrl);

        const res = await fetch(proxyUrl);
        const text = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const items = xmlDoc.querySelectorAll("item");
        let allFlights = [];

        items.forEach((item, index) => {
            if (index >= 20) return; // 최대 20개만 표시

            const rmk = item.querySelector("rmk")?.textContent || '';
            const airline = item.querySelector("airlineKorean")?.textContent || item.querySelector("airline")?.textContent || '';

            allFlights.push({
                airline: airline,
                flightId: item.querySelector("flightid")?.textContent || '',
                depAirport: item.querySelector("depAirport")?.textContent || '',
                arrAirport: item.querySelector("arrAirport")?.textContent || '',
                scheduledatetime: item.querySelector("scheduledatetime")?.textContent || '',
                rmk: rmk
            });
        });

        const departuresContent = document.getElementById('departures');
        if (departuresContent) {
            const flightTable = departuresContent.querySelector('.flight-table');
            if (flightTable && allFlights.length > 0) {
                let html = `
                    <div class="flight-row flight-header">
                        <div class="flight-col">航班号</div>
                        <div class="flight-col">目的地</div>
                        <div class="flight-col">计划时间</div>
                        <div class="flight-col">状态</div>
                    </div>`;
                allFlights.forEach(f => html += createFlightHTML(f, 'dep'));
                flightTable.innerHTML = html;
            } else if (flightTable && allFlights.length === 0) {
                flightTable.innerHTML = `
                    <div class="flight-row flight-header">
                        <div class="flight-col">航班号</div>
                        <div class="flight-col">目的地</div>
                        <div class="flight-col">计划时间</div>
                        <div class="flight-col">状态</div>
                    </div>
                    <div style="padding:40px; text-align:center; color:#999;">暂无出发航班信息</div>`;
            }
        }

        log('출발 항공편 데이터 로드 완료');
    } catch (e) {
        log('출발 항공편 API 오류: ' + e.message);
    }
}

// CCTV 스트리밍 초기화 (4개: 우도, 한라산, 1100도로, 성산일출봉)
function initCCTV() {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@latest';
    script.onload = function () {
        if (Hls.isSupported()) {
            const cctvCards = document.querySelectorAll('.cctv-card');
            const streams = [
                { url: 'http://211.114.96.121:1935/jejusi7/11-24.stream/playlist.m3u8', name: '牛岛 (天津港)' },
                { url: 'http://119.65.216.155:1935/live/cctv03.stream_360p/playlist.m3u8', name: '汉拿山 (御势岳)' },
                { url: 'http://119.65.216.155:1935/live/cctv05.stream_360p/playlist.m3u8', name: '1100高地' },
                { url: 'http://211.114.96.121:1935/jejusi7/11-24.stream/playlist.m3u8', name: '城山日出峰' }
            ];

            cctvCards.forEach((card, index) => {
                if (index < streams.length) {
                    const videoBox = card.querySelector('.cctv-video');
                    if (videoBox) {
                        const img = videoBox.querySelector('img');
                        if (img) {
                            const video = document.createElement('video');
                            video.autoplay = true;
                            video.muted = true;
                            video.playsInline = true;
                            video.style.width = '100%';
                            video.style.height = '100%';
                            video.style.objectFit = 'cover';

                            img.replaceWith(video);

                            const hls = new Hls();
                            hls.loadSource(streams[index].url);
                            hls.attachMedia(video);

                            const label = card.querySelector('.cctv-info h3');
                            if (label) label.textContent = streams[index].name;
                        }
                    }
                }
            });

            log('CCTV 스트리밍 초기화 완료');
        }
    };
    document.head.appendChild(script);
}

// 페이지 로드 시 모든 데이터 초기화
document.addEventListener('DOMContentLoaded', function () {
    // 지역 탭 전환 기능
    const locationTabs = document.querySelectorAll('.location-tab');
    const locationWeathers = document.querySelectorAll('.location-weather');

    locationTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetLocation = this.getAttribute('data-location');

            locationTabs.forEach(t => t.classList.remove('active'));
            locationWeathers.forEach(w => w.classList.remove('active'));

            this.classList.add('active');
            document.getElementById(`weather-${targetLocation}`).classList.add('active');
        });
    });

    // 항공편 탭 전환 기능
    const flightTabs = document.querySelectorAll('.flight-tab');
    const flightContents = document.querySelectorAll('.flight-content');

    flightTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const targetTab = this.getAttribute('data-tab');
            flightTabs.forEach(t => t.classList.remove('active'));
            flightContents.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });

    // 부드러운 스크롤
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // API 데이터 로드
    log('济州岛旅游网站初始化开始...');

    // CCTV 초기화
    initCCTV();

    // 4개 지역 날씨 데이터 로드
    setTimeout(() => loadWeatherForLocation('jeju'), 500);
    setTimeout(() => loadWeatherForLocation('seogwipo'), 1000);
    setTimeout(() => loadWeatherForLocation('hallasan'), 1500);
    setTimeout(() => loadWeatherForLocation('udo'), 2000);

    // 한라산 및 공항 정보
    setTimeout(initHallasan, 2500);
    setTimeout(initFlightData, 3000);

    log('济州岛旅游网站初始化完成！');
});
