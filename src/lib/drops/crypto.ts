const ITERATIONS = 210_000;

// ponytail: ciphertext lives in Postgres and uploads go through one request, so
// Vercel's ~4.5 MB body limit caps a drop. Move to Blob/R2 + chunked upload for bigger files.
export const MAX_DROP_BYTES = 4 * 1024 * 1024;
const enc = new TextEncoder();
const dec = new TextDecoder();

export interface DropFile {
  name: string;
  type: string;
  data: Uint8Array;
}

export interface DropContents {
  note: string;
  files: DropFile[];
}

export function toB64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function fromB64u(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** Splits PBKDF2(secret ‖ password) into an AES key and a server auth token. */
async function deriveKeys(secret: Uint8Array, salt: Uint8Array, password: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    concat(secret, enc.encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: concat(salt), iterations: ITERATIONS },
      material,
      512
    )
  );
  const key = await crypto.subtle.importKey("raw", bits.slice(0, 32), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return { key, authToken: toB64u(bits.slice(32)) };
}

/** Auth token only — lets the server verify the link + password before releasing ciphertext. */
export async function deriveAuthToken(secretB64u: string, saltB64u: string, password = "") {
  return (await deriveKeys(fromB64u(secretB64u), fromB64u(saltB64u), password)).authToken;
}

export async function sealDrop(contents: DropContents, password = "") {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const { key, authToken } = await deriveKeys(secret, salt, password);

  const header = enc.encode(
    JSON.stringify({
      note: contents.note,
      files: contents.files.map((f) => ({ name: f.name, type: f.type, size: f.data.length })),
    })
  );
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, header.length);
  const plain = concat(len, header, ...contents.files.map((f) => f.data));

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  );
  return {
    ciphertext,
    iv: toB64u(iv),
    salt: toB64u(salt),
    secret: toB64u(secret),
    authToken,
  };
}

export async function openDrop(
  ciphertext: Uint8Array,
  ivB64u: string,
  saltB64u: string,
  secretB64u: string,
  password = ""
): Promise<DropContents> {
  const { key } = await deriveKeys(fromB64u(secretB64u), fromB64u(saltB64u), password);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: concat(fromB64u(ivB64u)) },
      key,
      concat(ciphertext)
    )
  );
  const headerLen = new DataView(plain.buffer).getUint32(0);
  const header = JSON.parse(dec.decode(plain.subarray(4, 4 + headerLen))) as {
    note: string;
    files: { name: string; type: string; size: number }[];
  };
  let offset = 4 + headerLen;
  const files = header.files.map((f) => {
    const data = plain.slice(offset, offset + f.size);
    offset += f.size;
    return { name: f.name, type: f.type, data };
  });
  return { note: header.note, files };
}
