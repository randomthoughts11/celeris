import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canViewFinancials,
  hasRole,
} from "@/lib/rbac/permissions";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/format";

describe("RBAC permissions", () => {
  it("god_mode has all permissions", () => {
    expect(hasPermission(["god_mode"], "VIEW_FINANCIALS")).toBe(true);
    expect(hasPermission(["god_mode"], "IMPERSONATE")).toBe(true);
    expect(hasPermission(["god_mode"], "MANAGE_USERS")).toBe(true);
  });

  it("designer cannot view financials", () => {
    expect(canViewFinancials(["designer"])).toBe(false);
  });

  it("manager can view financials", () => {
    expect(canViewFinancials(["manager"])).toBe(true);
  });

  it("telecaller cannot manage campaigns", () => {
    expect(hasPermission(["telecaller"], "MANAGE_CAMPAIGNS")).toBe(false);
  });

  it("hasRole checks single role", () => {
    expect(hasRole(["manager", "admin"], "admin")).toBe(true);
    expect(hasRole(["manager"], "admin")).toBe(false);
  });
});

describe("format utilities", () => {
  it("formats currency", () => {
    expect(formatCurrency(1000)).toBe("$1,000");
  });

  it("formats percent", () => {
    expect(formatPercent(0.2246)).toBe("22.5%");
  });

  it("formats ROAS", () => {
    expect(formatRoas(4.2)).toBe("4.2x");
  });
});
