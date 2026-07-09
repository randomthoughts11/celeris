/**
 * Parse Privyr CSV exports (client list + activities).
 * Column names vary; we match common Privyr export headers flexibly.
 */

function col(row: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const found = Object.entries(row).find(
      ([h]) => h.toLowerCase().trim() === k.toLowerCase()
    );
    if (found?.[1]?.trim()) return found[1].trim();
  }
  return "";
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parsePrivyrCsv(csv: string): Array<{
  externalId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
  activityTitle: string;
  activityDescription: string;
  activityType: string;
  activityAt: string;
}> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] ?? "";
    });
    rows.push(row);
  }

  return rows.map((row) => {
    const fullName = col(row, "name", "client name", "full name", "client");
    const parts = fullName.split(/\s+/);
    const activity = col(row, "activity", "last activity", "activity type", "action");
    const activityDetail = col(row, "activity details", "activity description", "details", "notes");
    const activityDate = col(row, "activity date", "date", "last activity date", "created date");

    const typeMap: Record<string, string> = {
      call: "call",
      whatsapp: "whatsapp",
      sms: "message",
      message: "message",
      email: "email",
      note: "note",
    };
    const activityType =
      typeMap[activity.toLowerCase()] ??
      (activity.toLowerCase().includes("call")
        ? "call"
        : activity.toLowerCase().includes("whatsapp")
          ? "whatsapp"
          : "note");

    return {
      externalId: col(row, "client id", "id", "privyr id") || `${col(row, "phone", "mobile")}-${fullName}`,
      firstName: parts[0] || fullName || "Unknown",
      lastName: parts.slice(1).join(" "),
      email: col(row, "email", "email address"),
      phone: col(row, "phone", "mobile", "phone number", "contact number"),
      source: col(row, "source", "lead source") || "privyr",
      notes: col(row, "notes", "client notes", "additional details"),
      activityTitle: activity || "Privyr activity",
      activityDescription: activityDetail,
      activityType,
      activityAt: activityDate,
    };
  });
}
