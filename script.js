// API 키
const API_KEY = '05988a053767a7a6cc5553d077ce7ea541c60806a0160d5ac2e9119ebe5a61ce';

// Cloudflare Worker CORS 프록시
const WORKER_URL = 'https://jejuweb.k97460300.workers.dev';

// 중국 본토 + 대만 + 홍콩 도시 목록
const CHINA_TAIWAN_HK_CITIES = [
    // 중국 본토
    '상하이', '푸동', '浦东', 'shanghai', 'pudong',
    '베이징', '北京', 'beijing', '서우두', '다싱', 'daxing', 'shoudu',
    '청도', '칭다오', '青岛', 'qingdao',
    '항저우', '항조우', '杭州', 'hangzhou',
    '난징', '남경', '南京', 'nanjing',
    '심양', '선양', '沈阳', 'shenyang',
    '우시', '무석', '无锡', 'wuxi',
    '닝보', '宁波', 'ningbo',
    '선전', '심천', '深圳', 'shenzhen',
    '광저우', '广州', 'guangzhou',
    '청두', '成都', 'chengdu',
    '충칭', '重庆', 'chongqing',
    '시안', '西安', "xi'an", 'xian',
    '우한', '武汉', 'wuhan',
    '톈진', '天津', 'tianjin',
    '다롄', '大连', 'dalian',
    '옌타이', '烟台', 'yantai',
    '웨이하이', '威海', 'weihai',
    // 대만
    '타이페이', '타오위안', '台北', '桃园', 'taipei', 'taoyuan',
    '카오슝', '가오슝', '高雄', 'kaohsiung',
    // 홍콩
    '홍콩', '香港', 'hong kong', 'hongkong'
];

// 중국+대만+홍콩 도시인지 확인하는 함수
function isChinaTaiwanHK(cityName) {
    if (!cityName) return false;
    const lowerCity = cityName.toLowerCase();
    return CHINA_TAIWAN_HK_CITIES.some(city =>
        lowerCity.includes(city.toLowerCase()) ||
        cityName.includes(city)
    );
}

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

                // 시간대별 데이터 (모든 시간 저장)
                if (date === todayStr) {
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

            // 현재 날씨 업데이트 (tempDays, todayStr 전달)
            updateCurrentWeather(locationKey, hourly, now.getHours(), tempDays, todayStr);

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
function updateCurrentWeather(locationKey, hourly, currentHour, tempDays, todayStr) {
    // 현재 시간 또는 가장 가까운 시간 데이터 찾기
    let currentData = hourly[currentHour] || hourly[currentHour - 1] || hourly[currentHour + 1] || null;
    if (!currentData) {
        // 가장 가까운 시간 데이터 찾기
        const availableHours = Object.keys(hourly).map(Number).sort((a, b) => a - b);
        if (availableHours.length > 0) {
            const closest = availableHours.reduce((prev, curr) =>
                Math.abs(curr - currentHour) < Math.abs(prev - currentHour) ? curr : prev
            );
            currentData = hourly[closest];
        } else {
            currentData = {};
        }
    }
    const weatherDiv = document.querySelector(`#weather-${locationKey}`);
    const todayData = tempDays && todayStr ? tempDays[todayStr] : null;

    if (weatherDiv && (currentData.TMP || todayData)) {
        const currentWeatherDiv = weatherDiv.querySelector('.current-weather');
        if (!currentWeatherDiv) return;

        const icon = getWeatherIcon(parseInt(currentData.PTY || 0), parseInt(currentData.SKY || 1), currentHour);
        const desc = getWeatherDesc(parseInt(currentData.PTY || 0), parseInt(currentData.SKY || 1));
        const temp = currentData.TMP;
        const wind = currentData.WSD || '-';
        const pcp = currentData.PCP || '降水없음';
        const pcpDisplay = (pcp === '강수없음' || pcp === '降水없음') ? '0 mm' : pcp;

        // 최저/최고 온도
        let minTemp = '-';
        let maxTemp = '-';
        if (todayData) {
            if (todayData.min < 100) minTemp = Math.round(todayData.min);
            if (todayData.max > -100) maxTemp = Math.round(todayData.max);
            // TMN/TMX가 없으면 temps에서 추출
            if (minTemp === '-' && todayData.temps.length > 0) minTemp = Math.round(Math.min(...todayData.temps));
            if (maxTemp === '-' && todayData.temps.length > 0) maxTemp = Math.round(Math.max(...todayData.temps));
        }

        // 오늘 날짜 포맷
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        const dateStr = `${month}月${day}日`;

        currentWeatherDiv.innerHTML = `
            <div class="weather-main">
                <div class="weather-icon">${icon}</div>
                <div class="weather-temp"><span class="temp-value">${temp}</span><span class="temp-unit">°C</span></div>
                <div class="weather-desc">${desc}</div>
            </div>
            <div class="weather-details">
                <div class="weather-detail-item"><span class="detail-icon">📅</span><span class="detail-label">日期</span><span class="detail-value">${dateStr}</span></div>
                <div class="weather-detail-item"><span class="detail-icon">🌡️</span><span class="detail-label">最低/最高</span><span class="detail-value">${minTemp}° / ${maxTemp}°</span></div>
                <div class="weather-detail-item"><span class="detail-icon">💨</span><span class="detail-label">风速</span><span class="detail-value">${wind} m/s</span></div>
                <div class="weather-detail-item"><span class="detail-icon">🌧️</span><span class="detail-label">降水量</span><span class="detail-value">${pcpDisplay}</span></div>
            </div>`;
    }
}

// 시간대별 날씨 업데이트
function updateHourlyWeather(locationKey, hourly) {
    const hourlyScroll = document.querySelector(`#hourly-${locationKey}`);
    if (!hourlyScroll) return;

    let html = '';
    // 8시~22시 = 15개 (5개씩 3줄)
    const displayHours = [];
    for (let h = 8; h <= 22; h++) {
        if (hourly[h]) displayHours.push(h);
    }

    displayHours.forEach(h => {
        const d = hourly[h] || {};
        const icon = getWeatherIcon(parseInt(d.PTY || 0), parseInt(d.SKY || 1), h);

        let pcp = d.PCP || ''; // 강수량
        if (pcp === "강수없음") pcp = ""; // 모바일 공간 절약
        else if (pcp.includes("미만")) pcp = "~1mm";
        else if (!pcp.endsWith("mm")) pcp += "mm";

        const precipClass = (pcp !== '' && pcp !== '0mm') ? 'precip-blue' : '';
        const precipDisplay = pcp ? `<div class="hourly-precip ${precipClass}">${pcp}</div>` : '';

        html += `
            <div class="hourly-item">
                <div class="hourly-time">${h}时</div>
                <div class="hourly-icon">${icon}</div>
                <div class="hourly-temp">${d.TMP || '-'}°</div>
                ${precipDisplay}
            </div>`;
    });
    hourlyScroll.innerHTML = html;
}

// 주간 날씨 업데이트
async function updateWeeklyWeather(locationKey, tempDays, now) {
    const weeklyGrid = document.querySelector(`#weekly-${locationKey}`);
    if (!weeklyGrid) return;

    const yyyy = now.getFullYear();
    // getDay() 인덱스에 맞춤: 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
    const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

    // 중기예보 데이터 가져오기 (3~9일)
    const midTermData = await fetchMidTermForecast(locationKey);

    let html = '';

    for (let i = 0; i <= 9; i++) {
        const d = new Date(yyyy, now.getMonth(), now.getDate() + i);
        const dStr = getFormatDate(d);
        // 오늘은 '今天', 나머지는 요일 표시
        const dayName = i === 0 ? '今天' : dayNames[d.getDay()];

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

            // 중기예보에서 온도 데이터가 없으면 단기예보 fallback 시도
            if ((minT === '-' || maxT === '-') && tempDays[dStr]) {
                const t = tempDays[dStr];
                if (t.min === 100 && t.temps.length > 0) t.min = Math.min(...t.temps);
                if (t.max === -100 && t.temps.length > 0) t.max = Math.max(...t.temps);
                if (minT === '-' && t.min !== undefined && t.min !== 100) minT = Math.round(t.min);
                if (maxT === '-' && t.max !== undefined && t.max !== -100) maxT = Math.round(t.max);
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
async function loadHallasanInfo() {
    try {
        const url = 'https://jeju.go.kr/tool/hallasan/road-body.jsp';
        const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const html = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

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
            let trailsHtml = '';
            let statusCounts = { 정상: 0, 부분: 0, 통제: 0 };

            // HTML에서 dl.main-visit-list 요소들을 찾아서 파싱
            const dlElements = doc.querySelectorAll('dl.main-visit-list');

            trails.forEach((t, index) => {
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

                // 상태 집계
                statusCounts[st]++;

                const info = getStatusCN(st);
                const isLast = index === trails.length - 1;

                trailsHtml += `
                    <div class="trail-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; ${isLast ? '' : 'border-bottom: 1px solid rgba(255,255,255,0.05);'}">
                        <span style="font-size: 1rem; font-weight: 500;">${t.name}</span>
                        <span class="trail-status" style="background: ${info.c}; color: white; font-size: 0.75rem; padding: 4px 10px; border-radius: 4px; white-space: nowrap;">${info.t}</span>
                    </div>`;
            });

            trailsGrid.innerHTML = `
                <div class="trail-card consolidated-card" style="width: 100%; max-width: 600px; margin: 0 auto;">
                    <div class="trail-list">
                        ${trailsHtml}
                    </div>
                </div>`;

            // 전체 상태 요약 업데이트
            const statusCard = document.querySelector('.status-card');
            if (statusCard) {
                const now = new Date();
                const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                let statusIcon, statusTitle, statusDesc, statusClass;

                if (statusCounts.통제 === trails.length) {
                    // 모두 통제
                    statusIcon = '🔴';
                    statusTitle = '当前状态：全面管制';
                    statusDesc = '所有登山路线暂时关闭';
                    statusClass = 'status-closed';
                } else if (statusCounts.통제 > 0) {
                    // 일부 통제
                    statusIcon = '⚠️';
                    statusTitle = '当前状态：部分管制';
                    statusDesc = `${statusCounts.통제}条路线关闭，${statusCounts.정상}条路线开放`;
                    statusClass = 'status-partial';
                } else {
                    // 모두 정상
                    statusIcon = '✅';
                    statusTitle = '当前状态：开放';
                    statusDesc = '所有登山路线正常开放';
                    statusClass = 'status-open';
                }

                statusCard.className = `status-card ${statusClass}`;
                statusCard.innerHTML = `
                    <div class="status-icon">${statusIcon}</div>
                    <div class="status-content">
                        <h3>${statusTitle}</h3>
                        <p>${statusDesc}</p>
                        <div class="status-time">更新时间：${timeStr}</div>
                    </div>`;
            }
        }

        log('한라산 정보 로드 완료');
    } catch (e) {
        log('한라산 API 오류: ' + e.message);
        const statusCard = document.querySelector('.status-card');
        if (statusCard) {
            statusCard.innerHTML = `
                <div class="status-icon">⚠️</div>
                <div class="status-content">
                    <h3>获取状态失败</h3>
                    <p>暂时无法加载登山信息，请稍后再试</p>
                    <div class="status-time">错误: ${e.message}</div>
                </div>`;
        }
    }
}

// 공항 운항 정보 API
async function initFlightData() {
    const now = new Date();
    const todayStr = getFormatDate(now);

    log(`항공편 조회 날짜: ${todayStr} (오늘)`);

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

        // 예정 시간
        const scheduledTime = flight.scheduledatetime.slice(-4, -2) + ':' + flight.scheduledatetime.slice(-2);

        // 실제 시간 (estimatedatetime)
        const estimatedTime = flight.estimatedatetime ?
            flight.estimatedatetime.slice(-4, -2) + ':' + flight.estimatedatetime.slice(-2) : '';

        // 표시할 시간 (실제 시간이 있으면 실제 시간, 없으면 예정 시간)
        const displayTime = estimatedTime || scheduledTime;

        // 시간 변경 여부
        const timeChanged = estimatedTime && estimatedTime !== scheduledTime;
        const timeInfo = timeChanged ?
            `${displayTime}<br><small style="color: #888;">${scheduledTime} 시간변경</small>` :
            displayTime;

        return `
            <div class="flight-row">
                <div class="flight-col"><strong>${flight.flightId}</strong></div>
                <div class="flight-col">${route}</div>
                <div class="flight-col">${timeInfo}</div>
                <div class="flight-col"><span class="status-badge ${statusClass}">${statusText}</span></div>
            </div>`;
    };

    // 도착 항공편 - 출발 항공편과 동일한 필터링 방식 적용
    try {
        const arrUrl = `http://openapi.airport.co.kr/service/rest/StatusOfFlights/getArrFlightStatusList?serviceKey=${API_KEY}&airport_code=CJU&searchday=${todayStr}&numOfRows=500`;
        const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(arrUrl)}`;

        log('도착 항공편 API 호출:', arrUrl);

        const res = await fetch(proxyUrl);
        const text = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        const items = xmlDoc.querySelectorAll("item");
        let allFlights = [];

        log(`도착 항공편 API 응답: 총 ${items.length}개`);

        items.forEach((item, index) => {
            const rmk = item.querySelector("rmk")?.textContent || '';
            const airline = item.querySelector("airlineKorean")?.textContent || item.querySelector("airline")?.textContent || '';
            const scheduledatetime = item.querySelector("scheduledatetime")?.textContent || '';
            const depAirport = item.querySelector("depAirport")?.textContent || '';

            // 중국+대만+홍콩 노선만 필터링
            if (!isChinaTaiwanHK(depAirport)) {
                return;
            }

            // 날짜 필터링: 당일 항공편만 표시
            if (scheduledatetime && scheduledatetime.length >= 8) {
                const flightDate = scheduledatetime.substring(0, 8);
                if (flightDate !== todayStr) {
                    return;
                }
            }

            allFlights.push({
                airline: airline,
                flightId: item.querySelector("flightid")?.textContent || '',
                depAirport: depAirport,
                arrAirport: item.querySelector("arrAirport")?.textContent || '',
                scheduledatetime: scheduledatetime,
                estimatedatetime: item.querySelector("estimatedatetime")?.textContent || '',
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

        log(`도착 항공편 로드 완료: ${allFlights.length}개 (중국/대만/홍콩 노선)`);
    } catch (error) {
        log('도착 항공편 오류:', error);
    }

    // 출발 항공편
    try {
        const depUrl = `http://openapi.airport.co.kr/service/rest/StatusOfFlights/getDepFlightStatusList?serviceKey=${API_KEY}&airport_code=CJU&line=I&searchday=${todayStr}&from_time=0000&to_time=2359&pageNo=1&numOfRows=500`;
        const proxyUrl = `${WORKER_URL}?url=${encodeURIComponent(depUrl)}`;

        const res = await fetch(proxyUrl);
        const text = await res.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");

        const items = xmlDoc.querySelectorAll("item");
        let allFlights = [];

        log(`출발 항공편 API 응답: 총 ${items.length}개`);

        items.forEach((item, index) => {

            const rmk = item.querySelector("rmk")?.textContent || '';
            const airline = item.querySelector("airlineKorean")?.textContent || item.querySelector("airline")?.textContent || '';
            const scheduledatetime = item.querySelector("scheduledatetime")?.textContent || '';
            const depAirportCode = item.querySelector("depAirportCode")?.textContent || item.querySelector("airport_code")?.textContent || '';
            const arrAirport = item.querySelector("arrAirport")?.textContent || '';

            // 제주 공항 출발 항공편만 필터링 (CJU)
            if (depAirportCode !== 'CJU') {
                return; // 제주가 아니면 스킵
            }

            // 중국+대만+홍콩 노선만 필터링
            if (!isChinaTaiwanHK(arrAirport)) {
                return; // 중국/대만/홍콩이 아니면 스킵
            }

            if (scheduledatetime && scheduledatetime.length >= 8) {
                const flightDate = scheduledatetime.substring(0, 8); // YYYYMMDD
                if (flightDate !== todayStr) {
                    return; // 당일이 아니면 스킵
                }
            }

            allFlights.push({
                airline: airline,
                flightId: item.querySelector("flightid")?.textContent || '',
                depAirport: item.querySelector("depAirport")?.textContent || '',
                arrAirport: item.querySelector("arrAirport")?.textContent || '',
                scheduledatetime: scheduledatetime,
                estimatedatetime: item.querySelector("estimatedatetime")?.textContent || '',  // 실제 시간
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
        const cctvCards = document.querySelectorAll('.cctv-card');
        const streams = [
            { url: 'http://211.114.96.121:1935/jejusi7/11-24.stream/playlist.m3u8', name: '牛岛 (天津港)' },
            { url: 'https://www.jeju.go.kr/live/hallasan_baengnokdam.m3u8', name: '汉拿山 (百鹿潭)' },
            { url: 'https://www.jeju.go.kr/live/1100.m3u8', name: '1100高地' },
            { url: 'https://www.jeju.go.kr/live/seongsan.m3u8', name: '城山日出峰' }
        ];

        cctvCards.forEach((card, index) => {
            if (index < streams.length) {
                const videoBox = card.querySelector('.cctv-video');
                if (videoBox) {
                    const placeholder = videoBox.querySelector('.cctv-placeholder') || videoBox.querySelector('img');
                    if (placeholder) {
                        const video = document.createElement('video');
                        video.autoplay = true;
                        video.muted = true;
                        video.playsInline = true;
                        video.style.width = '100%';
                        video.style.height = '100%';
                        video.style.objectFit = 'cover';

                        placeholder.replaceWith(video);

                        const streamUrl = streams[index].url;

                        // HTTPS 스트림은 직접 접근, HTTP만 워커 프록시 사용 (403 및 Mixed Content 대응)
                        const proxiedUrl = streamUrl.startsWith('https') ? streamUrl : `${WORKER_URL}/?url=${encodeURIComponent(streamUrl)}`;

                        // 1. hls.js 지원 여부 확인 (대부분의 PC 브라우저 및 Android)
                        if (Hls.isSupported()) {
                            const hls = new Hls({
                                fragLoadingMaxRetry: 10,
                                manifestLoadingMaxRetry: 10,
                                levelLoadingMaxRetry: 10,
                                enableWorker: true,
                                xhrSetup: function (xhr, url) {
                                    xhr.withCredentials = false; // CORS 정책에 따라 설정
                                }
                            });
                            hls.loadSource(proxiedUrl);
                            hls.attachMedia(video);
                            hls.on(Hls.Events.MANIFEST_PARSED, function () {
                                video.play().catch(e => console.log("Auto-play prevented (HLS):", e));
                            });
                            hls.on(Hls.Events.ERROR, function (event, data) {
                                if (data.fatal) {
                                    console.log("HLS fatal error:", data.type);
                                }
                            });
                        }
                        // 2. 네이티브 HLS 지원 확인 (iOS Safari 등)
                        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                            video.src = proxiedUrl;
                            video.addEventListener('loadedmetadata', function () {
                                video.play().catch(e => console.log("Auto-play prevented (Native):", e));
                            });
                        }

                        const label = card.querySelector('.cctv-info h3');
                        if (label) label.textContent = streams[index].name;
                    }
                }
            }
        });

        log('CCTV 스트리밍 초기화 완료');
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
    setTimeout(loadHallasanInfo, 2500);
    setTimeout(initFlightData, 3000);

    log('济州岛旅游网站初始化完成！');
});
