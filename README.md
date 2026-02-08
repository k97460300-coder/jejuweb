# 济州岛旅游信息网站

## 🚨 重要提示：CORS 错误解决方法

由于浏览器安全限制，直接打开 `index.html` 文件会出现 CORS 错误，导致 API 数据无法加载。

### 解决方法 1：使用 Python 本地服务器（推荐）

1. **检查是否安装 Python**
   ```bash
   python --version
   ```

2. **运行本地服务器**
   - 双击 `start_server.bat` 文件
   - 或在命令行中运行：
     ```bash
     python -m http.server 8000
     ```

3. **打开浏览器访问**
   ```
   http://localhost:8000
   ```

### 解决方法 2：使用 Node.js 本地服务器

如果您安装了 Node.js：

```bash
npx http-server -p 8000
```

然后访问 `http://localhost:8000`

### 解决方法 3：使用 VS Code Live Server

1. 安装 VS Code
2. 安装 "Live Server" 扩展
3. 右键点击 `index.html` → "Open with Live Server"

### 解决方法 4：禁用浏览器 CORS 检查（临时，不推荐）

**Chrome:**
```bash
chrome.exe --disable-web-security --user-data-dir="C:/ChromeDevSession"
```

**Edge:**
```bash
msedge.exe --disable-web-security --user-data-dir="C:/EdgeDevSession"
```

⚠️ **警告**: 此方法会降低浏览器安全性，仅用于开发测试！

---

## 📋 功能列表

- ✅ 4个地区实时天气（济州市、西归浦市、汉拿山、牛岛）
- ✅ 10天天气预报
- ✅ 逐时天气预报（9h-22h）
- ✅ 4个CCTV实时监控
- ✅ 汉拿山登山路线状态
- ✅ 济州机场航班信息

## 🛠️ 技术栈

- HTML5 + CSS3 + JavaScript
- 韩国气象厅 API
- 机场公共数据 API
- HLS.js 视频流
- 济州道厅官网爬虫

## 📝 文件说明

- `index.html` - 主页面
- `style.css` - 样式表
- `script.js` - JavaScript 逻辑
- `start_server.bat` - 本地服务器启动脚本
