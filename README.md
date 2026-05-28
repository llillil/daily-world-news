# 🌍 今日世界重大事件 · Daily World News

每日自动抓取全球重大新闻，极简风格，永久免费托管于 GitHub Pages。

**特性：**
- 🔄 全自动运行，每日北京时间 09:00 更新
- 🛡️ 双数据源容灾（NewsAPI + GNews）
- 🌓 深色/浅色模式切换
- 🔥 重大紧急事件自动标注置顶
- 🔍 关键词搜索 + 分类筛选
- 📅 最近 30 天历史归档
- 📊 权威媒体标注
- 📤 一键复制链接 / 微信分享
- 🤖 AI 每日一句话摘要

## 🚀 部署步骤

### 1. 创建 GitHub 仓库

在 GitHub 创建**公开仓库**（如 `daily-world-news`），记下仓库名和用户名。

### 2. 获取 API 密钥

- **NewsAPI**（主源）：访问 https://newsapi.org/ 注册免费账号，获取 API Key
- **GNews**（备用源）：访问 https://gnews.io/ 注册免费账号，获取 API Key

### 3. 配置 GitHub Secrets

在仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Name | Value |
|------|-------|
| `NEWSAPI_KEY` | 你的 NewsAPI Key |
| `GNEWS_KEY` | 你的 GNews Key |

### 4. 推送代码

```bash
cd daily-news
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/你的用户名/你的仓库名.git
git push -u origin main
```

### 5. 启用 GitHub Pages

仓库 → Settings → Pages：
- Source: **GitHub Actions**
- 保存即可

### 6. 手动触发首次运行

仓库 → Actions → Daily World News → Run workflow → Run workflow

### 7. 访问网站

**https://你的用户名.github.io/你的仓库名/**

## 📋 文件结构

```
daily-news/
├── index.html          # 主页面（GitHub Pages 入口）
├── data.json           # 当日新闻数据（自动生成）
├── fetch_news.mjs      # 新闻抓取脚本（GitHub Actions 执行）
├── package.json        # Node.js 配置
├── .github/workflows/
│   └── daily-news.yml  # 定时任务（每日 UTC 01:00）
├── archive/
│   ├── manifest.json   # 存档索引
│   └── YYYY-MM-DD.json # 每日数据存档
└── README.md
```

## 🔧 应急手动切换数据源

1. 打开 `.github/workflows/daily-news.yml`
2. 修改 `NEWSAPI_KEY` 和 `GNEWS_KEY` 对应的 secret 值
3. 或直接编辑 `fetch_news.mjs`，在 `main()` 函数中调换 API 调用优先级

## ⚙️ 修改抓取规则

编辑 `fetch_news.mjs` 中的 `CONFIG` 对象：
- `excludeKeywords`：添加要过滤的关键词
- `categories`：修改分类关键词
- `REGION_MAP`：调整地区映射

## 📡 本地测试

```bash
npm run fetch        # 运行一次抓取（需要设置环境变量）
python -m http.server 8080  # 本地预览
```

环境变量：
```bash
set NEWSAPI_KEY=你的key
set GNEWS_KEY=你的key
node fetch_news.mjs
```
