import re

# Read the original file
with open(r'c:\Users\k9746\OneDrive\바탕 화면\website\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the weather section (from <!-- Weather Section --> to the next section)
weather_section_start = content.find('<!-- Weather Section -->')
hallasan_section_start = content.find('<!-- Hallasan Section -->')

# New weather section with 4 location tabs
new_weather_section = '''    <!-- Weather Section -->
    <section id="weather" class="section section-alt">
        <div class="container">
            <div class="section-header">
                <h2 class="section-title">🌤️ 天气预报</h2>
                <p class="section-subtitle">4大主要旅游区实时天气与未来10天预报</p>
            </div>

            <!-- Location Tabs -->
            <div class="location-tabs">
                <button class="location-tab active" data-location="jeju">
                    <span class="tab-icon">🏙️</span>
                    <span class="tab-name">济州市</span>
                    <span class="tab-sub">莲洞</span>
                </button>
                <button class="location-tab" data-location="seogwipo">
                    <span class="tab-icon">🌊</span>
                    <span class="tab-name">西归浦市</span>
                    <span class="tab-sub">中文</span>
                </button>
                <button class="location-tab" data-location="hallasan">
                    <span class="tab-icon">⛰️</span>
                    <span class="tab-name">汉拿山</span>
                    <span class="tab-sub">1100高地</span>
                </button>
                <button class="location-tab" data-location="udo">
                    <span class="tab-icon">🏝️</span>
                    <span class="tab-name">牛岛</span>
                    <span class="tab-sub">天津港</span>
                </button>
            </div>

            <!-- Weather Content for each location -->
            <div class="location-weather-content">
                <!-- Jeju City -->
                <div class="location-weather active" id="weather-jeju">
                    <div class="current-weather">
                        <div class="weather-main">
                            <div class="weather-icon">☀️</div>
                            <div class="weather-temp">
                                <span class="temp-value">18</span>
                                <span class="temp-unit">°C</span>
                            </div>
                            <div class="weather-desc">晴朗</div>
                        </div>
                        <div class="weather-details">
                            <div class="weather-detail-item">
                                <span class="detail-icon">💧</span>
                                <span class="detail-label">湿度</span>
                                <span class="detail-value">65%</span>
                            </div>
                            <div class="weather-detail-item">
                                <span class="detail-icon">💨</span>
                                <span class="detail-label">风速</span>
                                <span class="detail-value">3.2 m/s</span>
                            </div>
                        </div>
                    </div>
                    <div class="hourly-weather">
                        <h3 class="subsection-title">今日逐时预报</h3>
                        <div class="hourly-scroll" id="hourly-jeju"></div>
                    </div>
                    <div class="weekly-weather">
                        <h3 class="subsection-title">未来10天长期预报</h3>
                        <div class="weekly-grid" id="weekly-jeju"></div>
                    </div>
                </div>

                <!-- Seogwipo City -->
                <div class="location-weather" id="weather-seogwipo">
                    <div class="current-weather">
                        <div class="weather-main">
                            <div class="weather-icon">☀️</div>
                            <div class="weather-temp">
                                <span class="temp-value">19</span>
                                <span class="temp-unit">°C</span>
                            </div>
                            <div class="weather-desc">晴朗</div>
                        </div>
                        <div class="weather-details">
                            <div class="weather-detail-item">
                                <span class="detail-icon">💧</span>
                                <span class="detail-label">湿度</span>
                                <span class="detail-value">68%</span>
                            </div>
                            <div class="weather-detail-item">
                                <span class="detail-icon">💨</span>
                                <span class="detail-label">风速</span>
                                <span class="detail-value">4.1 m/s</span>
                            </div>
                        </div>
                    </div>
                    <div class="hourly-weather">
                        <h3 class="subsection-title">今日逐时预报</h3>
                        <div class="hourly-scroll" id="hourly-seogwipo"></div>
                    </div>
                    <div class="weekly-weather">
                        <h3 class="subsection-title">未来10天长期预报</h3>
                        <div class="weekly-grid" id="weekly-seogwipo"></div>
                    </div>
                </div>

                <!-- Hallasan -->
                <div class="location-weather" id="weather-hallasan">
                    <div class="current-weather">
                        <div class="weather-main">
                            <div class="weather-icon">⛅</div>
                            <div class="weather-temp">
                                <span class="temp-value">12</span>
                                <span class="temp-unit">°C</span>
                            </div>
                            <div class="weather-desc">多云</div>
                        </div>
                        <div class="weather-details">
                            <div class="weather-detail-item">
                                <span class="detail-icon">💧</span>
                                <span class="detail-label">湿度</span>
                                <span class="detail-value">75%</span>
                            </div>
                            <div class="weather-detail-item">
                                <span class="detail-icon">💨</span>
                                <span class="detail-label">风速</span>
                                <span class="detail-value">5.8 m/s</span>
                            </div>
                        </div>
                    </div>
                    <div class="hourly-weather">
                        <h3 class="subsection-title">今日逐时预报</h3>
                        <div class="hourly-scroll" id="hourly-hallasan"></div>
                    </div>
                    <div class="weekly-weather">
                        <h3 class="subsection-title">未来10天长期预报</h3>
                        <div class="weekly-grid" id="weekly-hallasan"></div>
                    </div>
                </div>

                <!-- Udo Island -->
                <div class="location-weather" id="weather-udo">
                    <div class="current-weather">
                        <div class="weather-main">
                            <div class="weather-icon">☀️</div>
                            <div class="weather-temp">
                                <span class="temp-value">17</span>
                                <span class="temp-unit">°C</span>
                            </div>
                            <div class="weather-desc">晴朗</div>
                        </div>
                        <div class="weather-details">
                            <div class="weather-detail-item">
                                <span class="detail-icon">💧</span>
                                <span class="detail-label">湿度</span>
                                <span class="detail-value">70%</span>
                            </div>
                            <div class="weather-detail-item">
                                <span class="detail-icon">💨</span>
                                <span class="detail-label">风速</span>
                                <span class="detail-value">6.2 m/s</span>
                            </div>
                        </div>
                    </div>
                    <div class="hourly-weather">
                        <h3 class="subsection-title">今日逐时预报</h3>
                        <div class="hourly-scroll" id="hourly-udo"></div>
                    </div>
                    <div class="weekly-weather">
                        <h3 class="subsection-title">未来10天长期预报</h3>
                        <div class="weekly-grid" id="weekly-udo"></div>
                    </div>
                </div>
            </div>
        </div>
    </section>

'''

# Replace the weather section
new_content = content[:weather_section_start] + new_weather_section + content[hallasan_section_start:]

# Write the new file
with open(r'c:\Users\k9746\OneDrive\바탕 화면\website\index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Weather section updated successfully!")
