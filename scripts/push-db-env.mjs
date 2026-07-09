import { readFileSync } from "fs";
import { execSync } from "child_process";

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

const local = parseEnv(readFileSync(".env.local", "utf8"));
const keys = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"];

for (const envName of ["production", "preview"]) {
  for (const key of keys) {
    const value = local[key];
    if (!value) continue;
    execSync(`npx vercel env add "${key}" ${envName} --force`, {
      input: value,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(`✓ ${key} → ${envName}`);
  }
}

console.log("Done.");
