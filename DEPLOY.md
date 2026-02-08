# 济州岛旅游信息网站 - 部署指南

## 🚀 部署选项

### 选项 1: Firebase Hosting (推荐)

**优点:**
- 免费 HTTPS
- 全球 CDN
- 自动 SSL 证书
- 快速部署

**步骤:**

1. **安装 Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **登录 Firebase**
   ```bash
   firebase login
   ```

3. **初始化项目**
   ```bash
   cd "c:\Users\k9746\OneDrive\바탕 화면\website"
   firebase init hosting
   ```
   - 选择 "Use an existing project" 或 "Create a new project"
   - Public directory: `.` (当前目录)
   - Configure as single-page app: No
   - Set up automatic builds: No

4. **部署**
   ```bash
   firebase deploy --only hosting
   ```

5. **访问网站**
   部署完成后会显示 URL，例如: `https://your-project.web.app`

---

### 选项 2: Cloudflare Pages

**优点:**
- 免费 HTTPS
- 无限带宽
- 全球 CDN
- GitHub 集成

**步骤:**

1. **创建 GitHub 仓库**
   - 访问 https://github.com/new
   - 创建新仓库 (例如: `jeju-travel-website`)

2. **上传代码到 GitHub**
   ```bash
   cd "c:\Users\k9746\OneDrive\바탕 화면\website"
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/jeju-travel-website.git
   git push -u origin main
   ```

3. **连接 Cloudflare Pages**
   - 访问 https://dash.cloudflare.com/
   - 点击 "Pages" → "Create a project"
   - 选择 "Connect to Git"
   - 选择你的 GitHub 仓库
   - Build settings:
     - Framework preset: None
     - Build command: (留空)
     - Build output directory: `/`
   - 点击 "Save and Deploy"

4. **访问网站**
   部署完成后会显示 URL，例如: `https://jeju-travel.pages.dev`

---

### 选项 3: GitHub Pages (简单)

**步骤:**

1. **创建 GitHub 仓库** (同上)

2. **启用 GitHub Pages**
   - 进入仓库 Settings → Pages
   - Source: Deploy from a branch
   - Branch: main / (root)
   - 点击 Save

3. **访问网站**
   URL: `https://YOUR_USERNAME.github.io/jeju-travel-website/`

---

## 🔧 本地测试

部署前先在本地测试:

```bash
cd "c:\Users\k9746\OneDrive\바탕 화면\website"
npx -y http-server -p 8000 -o
```

访问: `http://localhost:8000`

---

## 📝 注意事项

1. **API 密钥安全**: 
   - 当前 API 密钥在代码中是公开的
   - 建议使用环境变量或后端代理

2. **CORS 问题**:
   - 部署到 HTTPS 后 CORS 问题会减少
   - 如果仍有问题，可能需要后端代理

3. **文件清理**:
   部署前删除不必要的文件:
   ```bash
   rm script_old.js script_backup.js midterm_forecast.js weekly_update.js test_api.html
   ```

---

## 🎯 推荐方案

**最简单**: Firebase Hosting
- 3个命令即可部署
- 自动 HTTPS
- 免费

**最强大**: Cloudflare Pages
- GitHub 集成
- 自动部署
- 无限带宽
