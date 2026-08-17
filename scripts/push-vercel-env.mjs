import { readFileSync } from "fs";
import { execSync } from "child_process";
import { randomBytes } from "crypto";

const PROD_URL = "https://celeris-bice.vercel.app";
const SKIP = new Set(["VERCEL_OIDC_TOKEN", "NEXT_PUBLIC_DEMO_MODE"]);

const PLACEHOLDER_PATTERNS = [
  /^postgresql:\/\/user:password@ep-xxx/i,
  /^$/,
];

function isPlaceholder(key, value) {
  if (key === "DATABASE_URL" || key === "DATABASE_URL_UNPOOLED") {
    return PLACEHOLDER_PATTERNS.some((re) => re.test(value));
  }
  return false;
}

function parseEnv(content) {
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

const base = parseEnv(readFileSync(".env", "utf8"));
const local = parseEnv(readFileSync(".env.local", "utf8"));
const merged = { ...base };

for (const [key, value] of Object.entries(local)) {
  if (value && !SKIP.has(key)) merged[key] = value;
}

if (!merged.INTEGRATION_ENCRYPTION_KEY) {
  merged.INTEGRATION_ENCRYPTION_KEY = randomBytes(32).toString("base64");
}

const environments = ["production", "preview", "development"];
let count = 0;

for (const envName of environments) {
  for (const [key, value] of Object.entries(merged)) {
    if (SKIP.has(key) || !value || isPlaceholder(key, value)) continue;

    let finalValue = value;
    if (key === "NEXT_PUBLIC_APP_URL") {
      finalValue =
        envName === "development" ? "http://localhost:3000" : PROD_URL;
    }

    try {
      execSync(`npx vercel env add "${key}" ${envName} --force`, {
        input: finalValue,
        stdio: ["pipe", "pipe", "pipe"],
        cwd: process.cwd(),
      });
      count++;
      console.log(`✓ ${key} → ${envName}`);
    } catch (e) {
      console.error(`✗ ${key} → ${envName}: failed`);
    }
  }
}

console.log(`\nDone. ${count} variables set across environments.`);
