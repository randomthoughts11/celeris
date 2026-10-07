import { inflateRawSync } from "zlib";
import { istDay, phoneKey, type Claim } from "@/lib/call-audit/engine";

/** Read every file in a zip from its central directory. */
function unzip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error("Not a valid xlsx file");
  let p = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const skip = nameLen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(data) : data);
    p += 46 + skip;
  }
  return files;
}

const unescape = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const texts = (xml: string) => [...xml.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => unescape(m[1])).join("");
const colIndex = (ref: string) => [...ref.replace(/\d/g, "")].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

/** Workbook → [{ sheet, rows }] with rows as string grids. */
export function readXlsx(buf: Buffer): Array<{ sheet: string; rows: string[][] }> {
  const files = unzip(buf);
  const read = (name: string) => files.get(name)?.toString("utf8") ?? "";
  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? "";
  const rels = new Map(
    [...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map(([tag]) => [attr(tag, "Id"), attr(tag, "Target")])
  );
  return [...read("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)].map(([tag]) => {
    const name = attr(tag, "name");
    const target = (rels.get(attr(tag, "r:id")) ?? "").replace(/^\/?(xl\/)?/, "xl/");
    const rows: string[][] = [];
    for (const [, rowXml] of read(target).matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const [, attrs, inner] of rowXml.matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
        if (!ref) continue;
        const type = attrs.match(/t="(\w+)"/)?.[1];
        const v = inner?.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
        row[colIndex(ref)] = (type === "s" ? shared[Number(v)] ?? "" : type === "inlineStr" ? texts(inner ?? "") : unescape(v)).trim();
      }
      rows.push(Array.from(row, (c) => c ?? ""));
    }
    return { sheet: unescape(name), rows };
  });
}

function readCsv(text: string): string[][] {
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { rows[rows.length - 1].push(cell.trim()); cell = ""; }
    else if (ch === "\n") { rows[rows.length - 1].push(cell.trim()); rows.push([]); cell = ""; }
    else if (ch !== "\r") cell += ch;
  }
  rows[rows.length - 1].push(cell.trim());
  return rows;
}

/** Turn a share link into a direct download. */
export function downloadUrl(link: string): string {
  const url = new URL(link);
  if (url.hostname === "docs.google.com") {
    const id = url.pathname.match(/\/d\/([^/]+)/)?.[1];
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  }
  if (url.hostname === "1drv.ms" || url.hostname.endsWith("onedrive.live.com")) {
    return `https://api.onedrive.com/v1.0/shares/u!${Buffer.from(link).toString("base64url")}/root/content`;
  }
  if (url.hostname.endsWith("sharepoint.com")) url.searchParams.set("download", "1");
  return url.toString();
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Sheet dates come as Excel serials, "28th Sept", "Sept 28", ISO, or m/d/yyyy. */
export function parseSheetDay(raw: string, now = new Date()): string | null {
  const s = raw.trim();
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  const withYear = (m: number, d: number, y?: number) => {
    if (!m || !d || m > 12 || d > 31) return null;
    let year = y ?? Number(istDay(now).slice(0, 4));
    if (year < 100) year += 2000;
    let out = `${year}-${pad(m)}-${pad(d)}`;
    if (!y && out > istDay(new Date(+now + 2 * 86_400_000))) out = `${year - 1}-${pad(m)}-${pad(d)}`;
    return out;
  };
  if (/^\d{5}(\.\d+)?$/.test(s)) return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000).toISOString().slice(0, 10);
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return withYear(+m[2], +m[3], +m[1]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
  // ponytail: n/n dates are read as month/day unless the first part is over 12. Ambiguous days like 3/4 assume US order.
  if (m) return +m[1] > 12 ? withYear(+m[2], +m[1], m[3] ? +m[3] : undefined) : withYear(+m[1], +m[2], m[3] ? +m[3] : undefined);
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s*([A-Za-z]{3,})/);
  if (m && MONTHS[m[2].slice(0, 3).toLowerCase()]) return withYear(MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
  m = s.match(/([A-Za-z]{3,})\s*(\d{1,2})/);
  if (m && MONTHS[m[1].slice(0, 3).toLowerCase()]) return withYear(MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
  return null;
}

const norm = (h: string) => h.toLowerCase().replace(/\s+/g, " ").trim();
const pick = (headers: string[], names: string[]) => {
  const i = headers.findIndex((h) => names.includes(h));
  return i >= 0 ? i : null;
};

/** Every row with a phone and a call status becomes a claim. Only rows dated on/after `since` are kept. */
export function sheetClaims(tabs: Array<{ sheet: string; rows: string[][] }>, since: string, now = new Date()): Claim[] {
  const claims: Claim[] = [];
  for (const { sheet, rows } of tabs) {
    const headerAt = rows.findIndex((r) => r.some((c) => ["number", "phone number", "phone", "mobile"].includes(norm(c))));
    if (headerAt < 0) continue;
    const headers = rows[headerAt].map(norm);
    const phoneI = pick(headers, ["number", "phone number", "phone", "mobile", "contact number"]);
    const callI = pick(headers, ["call", "call status", "status"]);
    const dateI = pick(headers, ["last call", "last call date", "call date", "date"]);
    const nameI = pick(headers, ["name", "client name", "full name"]);
    const noteI = pick(headers, ["remarks", "remark", "notes", "comments"]);
    if (phoneI === null || callI === null || dateI === null) continue;
    for (const row of rows.slice(headerAt + 1)) {
      const key = phoneKey(row[phoneI]);
      const status = row[callI] ?? "";
      const day = parseSheetDay(row[dateI] ?? "", now);
      if (!key || !status || !day || day < since) continue;
      const note = (noteI !== null && row[noteI]) || "";
      const said = `${status} ${note}`;
      const missed = /did ?n.?t|not received|no response|no answer|busy|switch|unreach|voice ?mail|\bvm\b|rnr|ring/i.test(said);
      claims.push({
        phoneKey: key,
        name: (nameI !== null && row[nameI]) || key,
        source: "sheet",
        kind: !missed && /receiv|spoke|talk|connect|answer|interest|explain|asked/i.test(said) ? "conversation" : "call",
        at: null,
        day,
        text: `${sheet}, ${day}: ${status}${note ? ` (${note})` : ""}`,
      });
    }
  }
  return claims;
}

const SHARE_ERROR = (status: number) => `Could not download the sheet (${status}). Share it as "anyone with the link can view".`;

/** A SharePoint/OneDrive folder share link: every spreadsheet inside it, read with the link's guest cookie. */
async function sharePointFolder(link: string): Promise<Buffer[]> {
  const open = await fetch(link, { redirect: "manual" });
  const location = open.headers.get("location");
  if (!location) throw new Error(SHARE_ERROR(open.status));
  const cookie = open.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const target = new URL(location, link);
  const folder = target.searchParams.get("id") ?? "";
  const site = target.origin + folder.split("/").slice(0, 3).join("/");
  const path = (p: string) => `decodedurl='${encodeURIComponent(p.replace(/'/g, "''"))}'`;
  const list = await fetch(`${site}/_api/web/GetFolderByServerRelativePath(${path(folder)})/Files`, {
    headers: { cookie, accept: "application/json;odata=nometadata" },
  });
  if (!list.ok) throw new Error(SHARE_ERROR(list.status));
  const files = ((await list.json()).value as Array<{ Name: string; ServerRelativeUrl: string }>).filter((f) => /\.(xlsx|csv)$/i.test(f.Name));
  return Promise.all(
    files.map(async (f) => {
      const res = await fetch(`${site}/_api/web/GetFileByServerRelativePath(${path(f.ServerRelativeUrl)})/$value`, { headers: { cookie } });
      if (!res.ok) throw new Error(SHARE_ERROR(res.status));
      return Buffer.from(await res.arrayBuffer());
    })
  );
}

async function download(link: string): Promise<Buffer[]> {
  if (/sharepoint\.com\/:f:\//.test(link)) return sharePointFolder(link);
  const res = await fetch(downloadUrl(link), { redirect: "follow" });
  if (!res.ok) throw new Error(SHARE_ERROR(res.status));
  return [Buffer.from(await res.arrayBuffer())];
}

/** Download each configured sheet (or every sheet in a shared folder) and return its claims. */
export async function fetchSheetClaims(links: string[], since: string): Promise<{ claims: Claim[]; rows: number }> {
  const claims: Claim[] = [];
  let rows = 0;
  for (const buf of (await Promise.all(links.map(download))).flat()) {
    const tabs = buf.subarray(0, 2).toString() === "PK" ? readXlsx(buf) : [{ sheet: "Sheet", rows: readCsv(buf.toString("utf8")) }];
    rows += tabs.reduce((n, t) => n + t.rows.length, 0);
    claims.push(...sheetClaims(tabs, since));
  }
  return { claims, rows };
}
