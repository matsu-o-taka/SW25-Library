// Fetches raw sw25.wikidot.com monster pages as HTML. HTML is preferred because
// the wiki's `powertable` markup yields clean table cells for wide/narrow rows,
// unlike the Reader markdown variants which glue table columns together.
const UA = "Mozilla/5.0 (SW25-Library regeneration; community compendium builder)";
const BASE = "https://sw25.wikidot.com/monster:";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchMonsterPage(slug, { attempts = 3, delayMs = 350 } = {}) {
  const url = `${BASE}${slug}`;
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    if (attempt > 1) await delay(1500 * attempt);
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow" });
      const text = await response.text();
      if (response.status === 404 || /^\s*404/i.test(text) || /Fatactual|page you requested/i.test(text.slice(0, 2000))) {
        return { slug, url, status: "notfound", http: response.status, text: "" };
      }
      if (response.status === 429 || response.status >= 500) throw new Error(`HTTP ${response.status}`);
      if (text.length < 5000 || !/<table[\s>]/i.test(text)) throw new Error(`Page looks truncated (len ${text.length})`);
      return { slug, url, status: "ok", http: response.status, text };
    } catch (error) {
      lastError = error;
    }
  }
  return { slug, url, status: "error", http: lastError?.message ?? String(lastError), text: "" };
}

export class RateLimiter {
  constructor(concurrency = 2, delayMs = 350) { this.concurrency = concurrency; this.delayMs = delayMs; }
  async runAll(jobs) {
    const results = new Array(jobs.length);
    let next = 0;
    const worker = async (slot) => {
      while (next < jobs.length) {
        const index = next++;
        results[index] = await jobs[index]();
        await delay(this.delayMs);
      }
    };
    await Promise.all(Array.from({ length: Math.min(this.concurrency, jobs.length) }, (_, i) => worker(i)));
    return results;
  }
}
