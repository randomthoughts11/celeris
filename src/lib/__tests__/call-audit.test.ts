import { describe, it, expect } from "vitest";
import { judge, phoneKey, type AuditCall, type AuditLead, type Claim } from "@/lib/call-audit/engine";
import { parseSheetDay, sheetClaims } from "@/lib/call-audit/sheet";
import { lastBoundary } from "@/lib/call-audit/run";
import { clientMayOpen } from "@/lib/call-audit/access";

it("keeps brand clients on their own ad pages and the call audit", () => {
  const brands = ["vande-wellness-us"];
  expect(clientMayOpen("/call-audit", brands)).toBe(true);
  expect(clientMayOpen("/companies/vande-wellness-us/meta-ads", brands)).toBe(true);
  expect(clientMayOpen("/companies/vande-wellness-us/leads", brands)).toBe(false);
  expect(clientMayOpen("/companies/other-brand/meta-ads", brands)).toBe(false);
  expect(clientMayOpen("/vault", brands)).toBe(false);
});

it("floors to the 12 AM / 4 AM / 12 PM / 4 PM IST boundaries", () => {
  const b = (iso: string) => lastBoundary(new Date(iso)).toISOString();
  expect(b("2026-10-07T06:45:00Z")).toBe("2026-10-07T06:30:00.000Z");
  expect(b("2026-10-07T10:31:00Z")).toBe("2026-10-07T10:30:00.000Z");
  expect(b("2026-10-07T23:00:00Z")).toBe("2026-10-07T22:30:00.000Z");
  expect(b("2026-10-07T03:00:00Z")).toBe("2026-10-06T22:30:00.000Z");
});

const windowStart = new Date("2026-10-05T18:30:00Z");
const windowEnd = new Date("2026-10-06T06:30:00Z");
const at = (h: number) => new Date(+windowStart + h * 3_600_000);
const lead = (key: string, createdHour = 0): AuditLead => ({
  id: key, name: `Lead ${key}`, phone: key, phoneKey: key, campaign: "PK", createdAt: at(createdHour),
});
const call = (key: string, hour: number, duration: number, result = "Call connected"): AuditCall => ({
  phoneKey: key, direction: "outbound", start: at(hour), duration, result,
});
const claim = (key: string, hour: number, kind: Claim["kind"] = "call"): Claim => ({
  phoneKey: key, name: key, source: "privyr", kind, at: at(hour), day: null, text: "Called",
});

const run = (leads: AuditLead[], calls: AuditCall[], claims: Claim[] = []) =>
  judge({ windowStart, windowEnd, leads, calls, claims, voicemails: [], sheetDay: null });

describe("call audit", () => {
  it("normalises phones to the last 10 digits", () => {
    expect(phoneKey("+1 (619) 278-7999")).toBe("6192787999");
    expect(phoneKey("12345")).toBe("");
  });

  it("verifies 20s+ calls and treats shorter ones as cut by the operator", () => {
    const r = run([lead("1111111111"), lead("2222222222")], [call("1111111111", 1, 32), call("2222222222", 1, 19)]);
    expect(r.leads.map((l) => l.verdict)).toEqual(["verified", "cut_short"]);
  });

  it("catches claimed calls with no log, message-only, untouched and waiting leads", () => {
    const r = run(
      [lead("3333333333"), lead("4444444444"), lead("5555555555"), lead("6666666666", 11)],
      [],
      [claim("3333333333", 2), claim("4444444444", 2, "message")]
    );
    expect(r.leads.map((l) => l.verdict)).toEqual(["claimed_no_call", "message_only", "untouched", "waiting"]);
    expect(r.claims).toHaveLength(1);
    expect(r.claims[0].verdict).toBe("no_call");
  });

  it("lists leads and claims as unchecked when the call log is missing", () => {
    const r = judge({ windowStart, windowEnd, leads: [lead("9999999999")], claims: [claim("9999999999", 2)], calls: null, voicemails: [], sheetDay: null });
    expect(r.totals.leads).toBe(1);
    expect(r.leads[0].verdict).toBe("unchecked");
    expect(r.claims[0].verdict).toBe("unchecked");
  });

  it("reads sheet dates and call statuses", () => {
    const now = new Date("2026-09-29T12:00:00+05:30");
    expect(["28th Sept", "Sept 28", "9/28/2026", "28/9/2026", "45928"].map((s) => parseSheetDay(s, now))).toEqual([
      "2026-09-28", "2026-09-28", "2026-09-28", "2026-09-28", "2025-09-28",
    ]);
    const claims = sheetClaims(
      [{ sheet: "PK", rows: [
        ["Name", "Number", "Call", "Last call"],
        ["Asha", "+1 (559) 621-7001", "Received", "28th Sept"],
        ["Ben", "586-242-5339", "Did not receive", "28 Sep"],
        ["Cat", "5550001111", "", "28 Sep"],
      ] }],
      "2026-09-01",
      now
    );
    expect(claims.map((c) => [c.phoneKey, c.kind])).toEqual([["5596217001", "conversation"], ["5862425339", "call"]]);
  });

  it("backs a claim only with a real call near it", () => {
    const r = run([], [call("7777777777", 3, 45), call("8888888888", 3, 8)], [claim("7777777777", 3), claim("8888888888", 3)]);
    expect(r.claims.map((c) => c.verdict)).toEqual(["backed", "cut_short"]);
    expect(r.totals.claimsBacked).toBe(1);
  });
});
