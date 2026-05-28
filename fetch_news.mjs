// ============================================================
// Daily World News - Fetch & Process Script
// Runs in GitHub Actions, dual API sources with failover
// ============================================================

import { writeFileSync, mkdirSync, readdirSync, existsSync, readFileSync } from "fs";

// ---- CONFIGURATION ----
const CONFIG = {
  // 关键地区关键词
  regions: [
    "us", "cn", "ru", "ua", "gb", "fr", "de", "jp", "kr", "kp",
    "in", "ir", "il", "ps", "tw", "br", "au", "tr", "sa", "ae"
  ],
  // 目标分类关键词映射
  categories: {
    politics: [
      "election", "president", "minister", "parliament", "congress",
      "diplomatic", "sanction", "treaty", "summit", "NATO", "UN",
      "brexit", "sovereignty", "democracy", "coup", "protest",
      "bill", "legislation", "vote", "campaign", "party"
    ],
    conflict: [
      "war", "conflict", "military", "missile", "drone", "troops",
      "invasion", "ceasefire", "bomb", "strike", "artillery",
      "navy", "air force", "defense", "weapon", "nuclear",
      "attack", "battle", "offensive", "militia", "rebel"
    ],
    disaster: [
      "earthquake", "flood", "hurricane", "tsunami", "wildfire",
      "volcano", "typhoon", "tornado", "landslide", "drought",
      "storm", "cyclone", "avalanche", "epidemic", "outbreak",
      "casualty", "death toll", "evacuation", "rescue", "relief"
    ],
    economy: [
      "economy", "stock", "market", "trade", "tariff", "inflation",
      "recession", "GDP", "currency", "bank", "finance", "debt",
      "crypto", "bitcoin", "oil price", "sanction", "export",
      "import", "supply chain", "invest", "commodity"
    ],
    tech: [
      "AI", "artificial intelligence", "quantum", "chip", "semiconductor",
      "spaceX", "NASA", "rocket", "satellite", "Mars",
      "robot", "autonomous", "electric vehicle", "EV", "battery",
      "breakthrough", "research", "gene", "fusion", "neuralink"
    ],
    policy: [
      "policy", "regulation", "law", "ban", "restrict", "compliance",
      "immigration", "border", "climate", "carbon", "emission",
      "WHO", "UN", "resolution", "agreement", "pact"
    ]
  },
  // 过滤排除关键词（娱乐/体育/八卦）
  excludeKeywords: [
    "celebrity", "movie", "concert", "music award", "singer", "actor",
    "sport", "football", "soccer", "basketball", "tennis", "golf",
    "Olympic", "championship", "league", "tournament", "player",
    "gossip", "dating", "fashion", "beauty", "recipe", "diet",
    "horoscope", "gaming", "esport", "streamer", "influencer",
    "viral video", "tiktok", "meme", "reality show", "tv series"
  ]
};

// ---- Category Classifier ----
function classifyArticle(title, description = "") {
  const text = (title + " " + description).toLowerCase();
  const scores = {};

  for (const [cat, keywords] of Object.entries(CONFIG.categories)) {
    scores[cat] = keywords.filter(kw => text.includes(kw.toLowerCase())).length;
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : "politics"; // default to politics
}

// ---- Urgency Detector ----
function detectUrgency(title, description = "") {
  const text = (title + " " + description).toLowerCase();
  const urgentWords = [
    "breaking", "urgent", "emergency", "crisis", "explosion",
    "attack", "massacre", "deadly", "evacuation", "declared war",
    "martial law", "nuclear", "assassination", "coup", "severe"
  ];
  const score = urgentWords.filter(w => text.includes(w)).length;
  return score >= 2; // At least 2 urgent indicators
}

// ---- Region Extractor ----
const REGION_MAP = {
  us: "🇺🇸 美国", cn: "🇨🇳 中国", ru: "🇷🇺 俄罗斯", ua: "🇺🇦 乌克兰",
  gb: "🇬🇧 英国", fr: "🇫🇷 法国", de: "🇩🇪 德国", jp: "🇯🇵 日本",
  kr: "🇰🇷 韩国", kp: "🇰🇵 朝鲜", in: "🇮🇳 印度", ir: "🇮🇷 伊朗",
  il: "🇮🇱 以色列", ps: "🇵🇸 巴勒斯坦", tw: "🇨🇳 台湾", br: "🇧🇷 巴西",
  au: "🇦🇺 澳大利亚", tr: "🇹🇷 土耳其", sa: "🇸🇦 沙特", ae: "🇦🇪 阿联酋"
};

function extractRegion(title, description = "") {
  const text = (title + " " + description).toLowerCase();
  for (const [code, name] of Object.entries(REGION_MAP)) {
    if (text.includes(code)) return name;
  }
  return "🌍 国际";
}

// ---- Source Authority ----
const AUTHORITY_SOURCES = [
  "reuters", "associated press", "bbc", "cnn", "al jazeera",
  "bloomberg", "financial times", "new york times", "washington post",
  "guardian", "economist", "nature", "science", "nhk", "xinhua",
  "france 24", "dw", "abc", "nbc", "cbs"
];

function checkAuthority(sourceName) {
  const name = (sourceName || "").toLowerCase();
  return AUTHORITY_SOURCES.some(s => name.includes(s));
}

// ---- Fetch from NewsAPI (Primary) ----
async function fetchFromNewsAPI() {
  const key = process.env.NEWSAPI_KEY;
  if (!key || key === "YOUR_NEWSAPI_KEY") throw new Error("NewsAPI key not configured");

  // Fetch from multiple categories to maximize coverage
  const queries = [
    "world+affairs", "international+politics", "global+conflict",
    "disaster", "global+economy", "technology+breakthrough"
  ];

  let allArticles = [];
  const seen = new Set();

  for (const q of queries) {
    const url = `https://newsapi.org/v2/everything?q=${q}&language=en&sortBy=publishedAt&pageSize=30&apiKey=${key}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
      const data = await res.json();
      for (const art of (data.articles || [])) {
        const key2 = art.url || art.title;
        if (seen.has(key2)) continue;
        seen.add(key2);
        allArticles.push(art);
      }
    } catch (e) {
      console.warn("NewsAPI query failed:", q, e.message);
    }
  }

  return allArticles;
}

// ---- Fetch from GNews API (Fallback) ----
async function fetchFromGNews() {
  const key = process.env.GNEWS_KEY;
  if (!key || key === "YOUR_GNEWS_KEY") throw new Error("GNews key not configured");

  const topics = ["world", "nation", "business", "technology", "science", "health"];
  let allArticles = [];
  const seen = new Set();

  for (const topic of topics) {
    const url = `https://gnews.io/api/v4/top-headlines?category=${topic}&lang=en&max=30&apikey=${key}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GNews ${res.status}`);
      const data = await res.json();
      for (const art of (data.articles || [])) {
        const key2 = art.url || art.title;
        if (seen.has(key2)) continue;
        seen.add(key2);
        allArticles.push(art);
      }
    } catch (e) {
      console.warn("GNews query failed:", topic, e.message);
    }
  }

  return allArticles;
}

// ---- Generate AI Summary (template-based, no external API needed) ----
function generateSummary(articles) {
  if (articles.length === 0) return "今日暂无重大国际新闻更新。";

  const urgent = articles.filter(a => a.urgent);
  const categories = {};
  for (const a of articles) {
    categories[a.category] = (categories[a.category] || 0) + 1;
  }

  const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  const catNames = {
    politics: "国际政治", conflict: "地区冲突", disaster: "重大灾难",
    economy: "全球经济", tech: "前沿科技", policy: "国际政策"
  };

  const titles = articles.slice(0, 5).map(a => a.title.replace(/\s*[-\|].*$/, "").trim());
  const topTopics = [...new Set(titles.map(t => {
    const words = t.split(" ");
    return words.slice(0, Math.min(5, words.length)).join(" ");
  }))];

  let summary = `今日聚焦${catNames[topCat[0]] || "国际"}领域`;
  if (urgent.length > 0) {
    summary += `，共有 ${urgent.length} 条紧急事件需要关注`;
  }
  summary += `。热点议题包括：${topTopics.slice(0, 3).join("；")}。`;
  summary += `本日共收录 ${articles.length} 条重要国际新闻。`;

  return summary;
}

// ---- Main Process ----
async function main() {
  console.log("🌍 Daily World News - Starting fetch...");
  console.log("Time:", new Date().toISOString());

  let rawArticles = [];
  let source = "unknown";

  // Primary: NewsAPI
  try {
    console.log("📡 Primary: NewsAPI...");
    rawArticles = await fetchFromNewsAPI();
    source = "NewsAPI";
    console.log(`  Got ${rawArticles.length} articles`);
  } catch (e) {
    console.error("❌ NewsAPI failed:", e.message);
  }

  // Fallback: GNews
  if (rawArticles.length < 5) {
    try {
      console.log("📡 Fallback: GNews API...");
      const gnewsArticles = await fetchFromGNews();
      if (gnewsArticles.length > rawArticles.length) {
        rawArticles = gnewsArticles;
        source = "GNews";
      }
      console.log(`  Got ${gnewsArticles.length} articles`);
    } catch (e) {
      console.error("❌ GNews failed:", e.message);
    }
  }

  if (rawArticles.length === 0) {
    console.error("❌ Both APIs failed. Generating minimal page.");
  }

  // Process & Filter
  console.log("🔍 Processing articles...");
  let processed = [];

  for (const art of rawArticles) {
    const title = art.title || "";
    const description = art.description || art.content || "";
    const sourceName = art.source?.name || "";

    // Check exclude keywords
    const lowerText = (title + " " + description).toLowerCase();
    const shouldExclude = CONFIG.excludeKeywords.some(kw => lowerText.includes(kw));
    if (shouldExclude && !title.toLowerCase().includes("policy")) continue;

    const category = classifyArticle(title, description);
    const region = extractRegion(title, description);
    const urgent = detectUrgency(title, description);
    const authoritative = checkAuthority(sourceName);

    processed.push({
      title: title.trim(),
      description: (description || "暂无简介").slice(0, 200),
      url: art.url || "",
      imageUrl: art.image || art.urlToImage || "",
      source: sourceName || "Unknown",
      authoritative,
      publishedAt: art.publishedAt || new Date().toISOString(),
      category,
      region,
      urgent
    });
  }

  // Sort: urgent first, then by time
  processed.sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  // Deduplicate by title similarity
  const final = [];
  const titleSet = new Set();
  for (const art of processed) {
    const key = art.title.slice(0, 60).toLowerCase();
    if (titleSet.has(key)) continue;
    titleSet.add(key);
    final.push(art);
  }

  // Cap at 80 articles
  const articles = final.slice(0, 80);

  // Generate AI summary
  const aiSummary = generateSummary(articles);

  // Statistics
  const totalWords = articles.reduce((sum, a) =>
    sum + (a.title + a.description).split(/\s+/).length, 0);
  const readTime = Math.max(1, Math.round(totalWords / 200)); // 200 words/min

  // Output JSON
  const today = new Date().toISOString().split("T")[0];
  const output = {
    date: today,
    updatedAt: new Date().toISOString(),
    sources: source,
    aiSummary,
    stats: {
      totalArticles: articles.length,
      urgentCount: articles.filter(a => a.urgent).length,
      estimatedReadMinutes: readTime,
      categories: articles.reduce((acc, a) => {
        acc[a.category] = (acc[a.category] || 0) + 1;
        return acc;
      }, {})
    },
    articles
  };

  // Write main data.json
  writeFileSync("data.json", JSON.stringify(output, null, 2), "utf8");
  console.log("📄 data.json written");

  // Write to archive
  mkdirSync("archive", { recursive: true });
  writeFileSync(`archive/${today}.json`, JSON.stringify(output, null, 2), "utf8");
  console.log(`📁 archive/${today}.json written`);

  // Generate archive manifest
  const archives = readdirSync("archive")
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(".json", ""))
    .sort()
    .reverse()
    .slice(0, 30); // Keep last 30 days

  writeFileSync("archive/manifest.json", JSON.stringify(archives, null, 2), "utf8");
  console.log(`📋 Archive manifest: ${archives.length} days`);

  // Clean old archives (keep 30)
  if (archives.length > 30) {
    const allFiles = readdirSync("archive").filter(f => f.endsWith(".json") && f !== "manifest.json");
    for (const f of allFiles) {
      if (!archives.includes(f.replace(".json", ""))) {
        try { unlinkSync(`archive/${f}`); } catch {}
      }
    }
  }

  console.log("✅ Done! Generated", articles.length, "articles from", source);
  console.log("🔥 Urgent:", output.stats.urgentCount);
  console.log("📊 Categories:", JSON.stringify(output.stats.categories));
}

main().catch(e => {
  console.error("Fatal error:", e);
  // Generate fallback page
  const fallback = {
    date: new Date().toISOString().split("T")[0],
    updatedAt: new Date().toISOString(),
    sources: "none",
    aiSummary: "今日新闻数据抓取异常，请稍后刷新。若持续异常，请检查 API 密钥配置。",
    stats: { totalArticles: 0, urgentCount: 0, estimatedReadMinutes: 0, categories: {} },
    articles: []
  };
  writeFileSync("data.json", JSON.stringify(fallback, null, 2), "utf8");
  console.log("⚠️ Fallback page generated.");
  process.exit(1);
});
