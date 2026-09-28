import { describe, it, expect } from "vitest";
import { sealDrop, openDrop, deriveAuthToken } from "@/lib/drops/crypto";

describe("drop encryption", () => {
  const contents = {
    note: "hello — secret note",
    files: [
      { name: "a.txt", type: "text/plain", data: new TextEncoder().encode("alpha") },
      { name: "b.bin", type: "application/octet-stream", data: new Uint8Array([0, 1, 2, 255]) },
    ],
  };

  it("round-trips note and files, and binds the auth token to the password", async () => {
    const sealed = await sealDrop(contents, "pw");
    const opened = await openDrop(sealed.ciphertext, sealed.iv, sealed.salt, sealed.secret, "pw");
    expect(opened.note).toBe(contents.note);
    expect(opened.files.map((f) => f.name)).toEqual(["a.txt", "b.bin"]);
    expect(Array.from(opened.files[1].data)).toEqual([0, 1, 2, 255]);

    expect(await deriveAuthToken(sealed.secret, sealed.salt, "pw")).toBe(sealed.authToken);
    expect(await deriveAuthToken(sealed.secret, sealed.salt, "nope")).not.toBe(sealed.authToken);
    await expect(
      openDrop(sealed.ciphertext, sealed.iv, sealed.salt, sealed.secret, "nope")
    ).rejects.toThrow();
  }, 20_000);
});
