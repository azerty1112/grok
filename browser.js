// ==========================
// browser.js — ANTI-CLOUDFLARE EDITION (NON-HEADLESS)
// ==========================

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

const CONFIG = {
  COOKIES_FILE: path.join(__dirname, "cookies.json"),
  USER_DATA_DIR: path.join(__dirname, "user_data"),
  VIEWPORT: { width: 1366, height: 768 },
  DEFAULT_TIMEOUT: 90000,
  SLOW_MO: 20,
  RETRY_LAUNCH: 3,
  GROK_URL: "https://grok.com/imagine",
  USER_AGENTS: [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  ]
};

// ==========================
// LOAD COOKIES
// ==========================
async function loadCookies() {
  try {
    if (!fs.existsSync(CONFIG.COOKIES_FILE)) {
      fs.writeFileSync(CONFIG.COOKIES_FILE, "[]", "utf8");
      return [];
    }

    const text = fs.readFileSync(CONFIG.COOKIES_FILE, "utf8").trim();
    if (!text) return [];

    const cookies = JSON.parse(text);
    if (!Array.isArray(cookies)) throw new Error("Cookies not array");

    console.log(`🍪 Loaded ${cookies.length} cookies.`);
    return cookies;
  } catch (err) {
    console.log("⚠️ Invalid cookies.json — resetting file.");
    fs.writeFileSync(CONFIG.COOKIES_FILE, "[]", "utf8");
    return [];
  }
}

// ==========================
// SAVE COOKIES
// ==========================
async function saveCookies(page) {
  try {
    const cookies = await page.cookies();
    fs.writeFileSync(CONFIG.COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`💾 Saved ${cookies.length} cookies.`);
  } catch (err) {
    console.error("❌ Failed to save cookies:", err.message);
  }
}

// ==========================
// LAUNCH BROWSER (ANTI-CLOUDFLARE)
// ==========================
async function launchBrowser() {
  let attempt = 0;
  let browser;

  while (attempt < CONFIG.RETRY_LAUNCH) {
    try {
      console.log(`🚀 Launching browser (attempt ${attempt + 1})...`);

      browser = await puppeteer.launch({
        headless: false,
        userDataDir: CONFIG.USER_DATA_DIR,
        slowMo: CONFIG.SLOW_MO,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--start-maximized",
          "--disable-web-security",
          "--disable-features=IsolateOrigins,site-per-process",
          "--disable-infobars",
          "--window-size=1366,768",
          "--disable-extensions-except",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-software-rasterizer",
          "--ignore-certificate-errors",
          "--disable-features=TranslateUI",
          "--metrics-recording-only",
          "--disable-default-apps",
          "--mute-audio"
        ]
      });

      break;
    } catch (err) {
      console.error("❌ Browser launch failed:", err.message);
      attempt++;
      if (attempt >= CONFIG.RETRY_LAUNCH) throw err;
      await new Promise(r => setTimeout(r, 4000));
    }
  }

  const pages = await browser.pages();
  const page = pages.length ? pages[0] : await browser.newPage();

  await page.setViewport(CONFIG.VIEWPORT);
  await page.setDefaultTimeout(CONFIG.DEFAULT_TIMEOUT);
  await page.setDefaultNavigationTimeout(90000);

  // ==========================
  // ANTI-BOT FINGERPRINTS
  // ==========================
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4] });
    Object.defineProperty(navigator, "platform", { get: () => "Win32" });

    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: "denied" })
        : originalQuery(parameters);
  });

  // ==========================
  // RANDOM USER-AGENT
  // ==========================
  const ua = CONFIG.USER_AGENTS[Math.floor(Math.random() * CONFIG.USER_AGENTS.length)];
  await page.setUserAgent(ua);
  console.log("🕵️ User-Agent set:", ua);

  // ==========================
  // APPLY COOKIES
  // ==========================
  const cookies = await loadCookies();
  if (cookies.length > 0) {
    try {
      await page.setCookie(...cookies);
      console.log("🔄 Cookies applied.");
    } catch (e) {
      console.log("⚠️ Failed to apply cookies:", e.message);
    }
  }

  // ==========================
  // OPEN GROK IMAGINE
  // ==========================
  console.log("🌐 Opening Grok Imagine...");
  await page.goto(CONFIG.GROK_URL, { waitUntil: "networkidle2" });

  await page.waitForSelector(config.PAGE_READY_SELECTOR, { timeout: 60000 });
  console.log("✅ Page ready for input.");

  // ==========================
  // SAVE COOKIES POST-LOAD
  // ==========================
  await saveCookies(page);

  // ==========================
  // PAGE ERROR HANDLERS
  // ==========================
  page.on("close", async () => {
    console.log("⚠️ Page closed unexpectedly — relaunching...");
    const newBrowser = await launchBrowser();
    return newBrowser.page;
  });

  page.on("error", err => console.error("Page error:", err.message));
  page.on("pageerror", err => console.error("Page crash:", err.message));

  console.log("✅ Browser ready (Anti-Cloudflare mode).");
  return { browser, page };
}

module.exports = {
  launchBrowser,
  saveCookies
};
