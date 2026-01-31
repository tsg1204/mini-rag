import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Parser from "rss-parser";

const MAX_ITEMS_PER_FEED = 25;     // prevent OOM (tune: 10–50)
const MAX_BODY_CHARS = 80_000;     // cap per document before chunking

type SourceGroup = "nih" | "apple" | "dataverse" | "other";

type DocType =
  | "news_release"
  | "funding_opportunity"
  | "dev_news"
  | "os_release"
  | "github_release"
  | "unknown";


/**
 * FEEDS (5 sources)
 */
const FEEDS: Array<{ source: string; feedUrl: string }> = [
  // NIH
  { source: "NIH News Releases", feedUrl: "https://www.nih.gov/news-releases/feed.xml" },
  { source: "NIH Guide - Funding Opportunities", feedUrl: "https://grants.nih.gov/grants/guide/newsfeed/fundingopps.xml" },

  // Apple Developer
  { source: "Apple Developer News", feedUrl: "https://developer.apple.com/news/rss/news.rss" },
  { source: "Apple Developer Releases", feedUrl: "https://developer.apple.com/news/releases/rss/releases.rss" },

  // Dataverse (GitHub Releases Atom feed)
  { source: "Dataverse (GitHub Releases)", feedUrl: "https://github.com/IQSS/dataverse/releases.atom" },
];

/**
 * Types
 */
type FeedDoc = {
  source: string;
  feedUrl: string;
  title?: string;
  link?: string;
  guid?: string;
  publishedAt?: string; // ISO
  summary?: string;
  content?: string; // sometimes HTML
  categories?: string[];
  dedupeKey: string;
  sourceGroup: SourceGroup;
  docType: DocType;
  topicTags: string[];
  retrievalHints?: {
    product?: string;   // e.g., iOS, macOS, Xcode
    version?: string;   // e.g., 17.3, 15.1
  };
  ingestedAt: string; // ISO timestamp

};

type ChunkRecord = {
  id: string; // stable chunk id
  docId: string; // parent document id (dedupeKey)
  chunkIndex: number;

  text: string;

  // Metadata for filtering
  source: string;
  feedUrl: string;
  title?: string;
  link?: string;
  guid?: string;
  publishedAt?: string;
  categories?: string[];
  sourceGroup: SourceGroup;
  docType: DocType;
  topicTags: string[];
  retrievalHints?: {
    product?: string;
    version?: string;
  };
  ingestedAt: string; // ISO timestamp

};

/**
 * Small utilities
 */
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function normalizeText(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length ? t : undefined;
}

function toISODate(item: any): string | undefined {
  if (item?.isoDate) return item.isoDate;
  if (item?.pubDate) {
    const d = new Date(item.pubDate);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return undefined;
}

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Canonicalize URLs so tracking params don't create duplicates.
 */
function canonicalizeUrl(urlStr?: string): string | undefined {
  if (!urlStr) return undefined;
  try {
    const u = new URL(urlStr);

    // Remove common tracking params
    const removeParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "mc_cid",
      "mc_eid",
    ];
    for (const p of removeParams) u.searchParams.delete(p);

    // Remove any utm_*
    for (const key of Array.from(u.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_")) u.searchParams.delete(key);
    }

    u.hash = "";
    let s = u.toString();
    // Strip trailing slash (except root)
    if (s.endsWith("/") && u.pathname !== "/") s = s.slice(0, -1);
    return s;
  } catch {
    return urlStr.trim() || undefined;
  }
}

function stripHtml(input: string): string {
  // Very simple HTML to text (good enough for RSS content)
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/p>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Dedupe key priority:
 * 1) guid
 * 2) canonicalized link
 * 3) fallback hash of source + title + publishedAt
 */
function makeDedupeKey(params: {
  guid?: string;
  link?: string;
  title?: string;
  publishedAt?: string;
  source: string;
}): string {
  const guid = normalizeText(params.guid);
  if (guid) return `guid:${guid}`;

  const link = canonicalizeUrl(params.link);
  if (link) return `link:${link}`;

  const title = normalizeText(params.title) ?? "";
  const publishedAt = params.publishedAt ?? "";
  return `hash:${sha256(`${params.source}||${title}||${publishedAt}`)}`;
}

/**
 * Seen keys persistence
 */
function loadSeenKeys(filePath: string): Set<string> {
  try {
    if (!fs.existsSync(filePath)) return new Set();
    const raw = fs.readFileSync(filePath, "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.filter((x) => typeof x === "string"));
    return new Set();
  } catch {
    return new Set();
  }
}

function saveSeenKeys(filePath: string, keys: Set<string>) {
  const arr = Array.from(keys);
  fs.writeFileSync(filePath, JSON.stringify(arr, null, 2), "utf8");
}

/**
 * Choose the best text to chunk:
 * Prefer longer content, otherwise summary.
 */
function chooseBestBody(record: { content?: string; summary?: string }): string | undefined {
  const cRaw = record.content?.trim();
  const sRaw = record.summary?.trim();

  // Prefer longer candidate
  const bestRaw =
    cRaw && sRaw ? (cRaw.length >= sRaw.length ? cRaw : sRaw) : (cRaw ?? sRaw);

  if (!bestRaw) return undefined;

  // Convert HTML-ish content to plain text and cap size
  const plain = stripHtml(bestRaw);

  if (!plain) return undefined;

  // Cap to avoid gigantic strings blowing up memory
  return plain.length > MAX_BODY_CHARS ? plain.slice(0, MAX_BODY_CHARS) : plain;
}


/**
 * SIMPLE CHUNKING (readable):
 * fixed-size chunks with overlap, based on characters
 */
type ChunkingOptions = {
  maxChars: number; // e.g. 1200–2000
  overlapChars: number; // e.g. 150–250
};

function chunkTextSimple(text: string, opts: { maxChars: number; overlapChars: number }): string[] {
  const maxChars = Math.max(200, Math.floor(opts.maxChars)); // safety
  const overlapChars = Math.max(0, Math.floor(opts.overlapChars));

  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];

  // Critical safety: overlap must be smaller than chunk size
  const safeOverlap = Math.min(overlapChars, maxChars - 1);

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + maxChars, clean.length);
    const chunk = clean.slice(start, end).trim();
    if (chunk) chunks.push(chunk);

    if (end >= clean.length) break;

    start = end - safeOverlap;
    if (start < 0) start = 0;

    // final safety guard
    if (chunks.length > 10_000) break;
  }

  return chunks;
}

function classifySourceGroup(source: string): SourceGroup {
  const s = source.toLowerCase();
  if (s.includes("nih")) return "nih";
  if (s.includes("apple")) return "apple";
  if (s.includes("dataverse")) return "dataverse";
  return "other";
}

function classifyDocType(source: string, feedUrl: string): DocType {
  const s = source.toLowerCase();
  const u = feedUrl.toLowerCase();

  if (s.includes("nih news")) return "news_release";
  if (s.includes("funding")) return "funding_opportunity";

  if (s.includes("apple developer releases") || u.includes("/releases/rss/")) return "os_release";
  if (s.includes("apple developer news")) return "dev_news";

  if (s.includes("dataverse") && (u.includes("releases.atom") || u.includes("github.com"))) return "github_release";

  return "unknown";
}

// lightweight product/version extraction (helps later for filtering)
function extractAppleHints(title?: string) {
  if (!title) return {};
  const t = title;

  // product guess (very simple)
  const products = ["iOS", "iPadOS", "macOS", "watchOS", "tvOS", "visionOS", "Xcode", "Safari"];
  const product = products.find((p) => new RegExp(`\\b${p}\\b`, "i").test(t));

  // version guess: matches 17, 17.2, 17.2.1 etc.
  const versionMatch = t.match(/\b(\d{1,2}(?:\.\d{1,2}){0,2})\b/);
  const version = versionMatch?.[1];

  return {
    product: product,
    version: version,
  };
}

function inferTopicTags(docType: DocType, title?: string): string[] {
  const tags = new Set<string>();
  const t = (title ?? "").toLowerCase();

  // doc-type driven tags
  if (docType === "funding_opportunity") tags.add("funding");
  if (docType === "news_release") tags.add("announcement");
  if (docType === "os_release") tags.add("release");
  if (docType === "github_release") tags.add("release-notes");

  // keyword tags (keep small & useful)
  const rules: Array<[RegExp, string]> = [
    [/data sharing|sharing/i, "data-sharing"],
    [/policy|notice|guidance/i, "policy"],
    [/security|vulnerab|cve/i, "security"],
    [/privacy/i, "privacy"],
    [/xcode|sdk|api/i, "developer-tools"],
    [/machine learning|ai|model/i, "ai"],
    [/clinical|trial/i, "clinical"],
    [/covid|influenza|virus/i, "infectious-disease"],
  ];

  for (const [re, tag] of rules) {
    if (re.test(t)) tags.add(tag);
  }

  return Array.from(tags);
}


async function main() {
  const parser = new Parser({
    timeout: 30_000,
    headers: {
      "User-Agent": "mini-rag-feed-ingest/1.0 (+local)",
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5",
    },
  });

  const outDir = path.join(process.cwd(), "out");
  ensureDir(outDir);

  // Dedupe storage
  const seenPath = path.join(outDir, "seen_keys.json");
  const seen = loadSeenKeys(seenPath);

  // Output files (daily)
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const docsPath = path.join(outDir, `feed_items_${day}.jsonl`);
  const chunksPath = path.join(outDir, `chunks_${day}.jsonl`);

  const docsStream = fs.createWriteStream(docsPath, { flags: "w" });
  const chunksStream = fs.createWriteStream(chunksPath, { flags: "w" });

  // Chunk settings (tune later)
  const CHUNK_OPTS: ChunkingOptions = { maxChars: 1500, overlapChars: 200 };
  const ingestedAt = new Date().toISOString();


  let totalParsed = 0;
  let totalNewDocs = 0;
  let totalSkipped = 0;
  let totalChunks = 0;

  // Dedupe within a single run too (in case same item appears in multiple feeds)
  const seenThisRun = new Set<string>();

  for (const feed of FEEDS) {
    console.log(`\nFetching: ${feed.source}\n  ${feed.feedUrl}`);

    try {
      const parsed = await parser.parseURL(feed.feedUrl);
      const allItems = parsed.items ?? [];
      const items = allItems.slice(0, MAX_ITEMS_PER_FEED);
      console.log(`  Items in feed: ${allItems.length} (processing ${items.length})`);
      
      try {
        for (const item of items) {
          totalParsed++;
  
          const title = normalizeText(item.title);
          const linkRaw = item.link ? String(item.link) : undefined;
          const link = canonicalizeUrl(linkRaw) ?? linkRaw;
  
          const guid = (item as any).guid ? String((item as any).guid) : undefined;
          const publishedAt = toISODate(item);
  
          const summary = normalizeText((item as any).contentSnippet ?? (item as any).summary);
          const content = (item as any).content ? String((item as any).content) : undefined;
  
          const dedupeKey = makeDedupeKey({
            guid,
            link,
            title,
            publishedAt,
            source: feed.source,
          });
  
          // Skip duplicates across runs or inside the current run
          if (seen.has(dedupeKey) || seenThisRun.has(dedupeKey)) {
            totalSkipped++;
            continue;
          }

          const sourceGroup = classifySourceGroup(feed.source);
          const docType = classifyDocType(feed.source, feed.feedUrl);
          const topicTags = inferTopicTags(docType, title);
          
          const retrievalHints =
            sourceGroup === "apple" ? extractAppleHints(title) : {};
  
          const doc: FeedDoc = {
            source: feed.source,
            feedUrl: feed.feedUrl,
            title,
            link,
            guid,
            publishedAt,
            summary,
            content,
            categories: Array.isArray(item.categories) ? item.categories : undefined,
            dedupeKey,
          
            sourceGroup,
            docType,
            topicTags,
            retrievalHints: Object.keys(retrievalHints).length ? retrievalHints : undefined,
            ingestedAt,
          };
          
          
          // Quality gate: if there’s truly no text, skip
          const body = chooseBestBody({ content: doc.content, summary: doc.summary });
          if (!doc.title && !body) {
            totalSkipped++;
            continue;
          }
  
          // Mark as seen (important: do this BEFORE writing chunks)
          seen.add(dedupeKey);
          seenThisRun.add(dedupeKey);
  
          // Write doc record
          docsStream.write(JSON.stringify(doc) + "\n");
          totalNewDocs++;
  
          // CHUNKING: create chunk records for this new doc
          if (body) {
            const chunkTexts = chunkTextSimple(body, CHUNK_OPTS);
  
            chunkTexts.forEach((text, idx) => {
              const chunkRec: ChunkRecord = {
                id: `${doc.dedupeKey}::chunk:${idx}`,
                docId: doc.dedupeKey,
                chunkIndex: idx,
                text,
  
                source: doc.source,
                feedUrl: doc.feedUrl,
                title: doc.title,
                link: doc.link,
                guid: doc.guid,
                publishedAt: doc.publishedAt,
                categories: doc.categories,
                sourceGroup: doc.sourceGroup,
                docType: doc.docType,
                topicTags: doc.topicTags,
                retrievalHints: doc.retrievalHints,
                ingestedAt: doc.ingestedAt,
              };
  
              chunksStream.write(JSON.stringify(chunkRec) + "\n");
              totalChunks++;
            });
          }
        }
      } catch (e: any) {
        console.error(`    ⚠️ Skipping one item due to error: ${e?.message ?? String(e)}`);
        totalSkipped++;
        continue;
      }

    } catch (err: any) {
      console.error(`  ❌ Failed: ${feed.source}`);
      console.error(`  Reason: ${err?.message ?? String(err)}`);
    }
  }

  docsStream.end();
  chunksStream.end();

  saveSeenKeys(seenPath, seen);

  console.log(
    `\n✅ Done.
Parsed items:     ${totalParsed}
New documents:    ${totalNewDocs}
Skipped (dedupe): ${totalSkipped}
Chunks written:   ${totalChunks}

Docs:   ${docsPath}
Chunks: ${chunksPath}
SeenDB: ${seenPath}\n`
  );
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
