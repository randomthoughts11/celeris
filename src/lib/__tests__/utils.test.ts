import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canViewFinancials,
  hasRole,
} from "@/lib/rbac/permissions";
import {
  canSeeCompanyNavItem,
  canSeeGlobalNav,
  isTelecallerFocused,
} from "@/lib/rbac/nav";
import { formatCurrency, formatPercent, formatRoas } from "@/lib/format";
import { verifyWebhookSecret } from "@/lib/integrations/lead-sync";

describe("RBAC permissions", () => {
  it("god_mode has all permissions", () => {
    expect(hasPermission(["god_mode"], "VIEW_FINANCIALS")).toBe(true);
    expect(hasPermission(["god_mode"], "IMPERSONATE")).toBe(true);
    expect(hasPermission(["god_mode"], "MANAGE_USERS")).toBe(true);
    expect(hasPermission(["god_mode"], "MANAGE_BRAND_SETUP")).toBe(true);
  });

  it("designer cannot view financials or leads", () => {
    expect(canViewFinancials(["designer"])).toBe(false);
    expect(hasPermission(["designer"], "ACCESS_LEADS")).toBe(false);
    expect(hasPermission(["designer"], "ACCESS_BOARD")).toBe(true);
  });

  it("manager can view financials and set up brands", () => {
    expect(canViewFinancials(["manager"])).toBe(true);
    expect(hasPermission(["manager"], "MANAGE_BRAND_SETUP")).toBe(true);
    expect(hasPermission(["manager"], "MANAGE_ALL_COMPANIES")).toBe(false);
  });

  it("telecaller cannot manage campaigns", () => {
    expect(hasPermission(["telecaller"], "MANAGE_CAMPAIGNS")).toBe(false);
  });

  it("hasRole checks single role", () => {
    expect(hasRole(["manager", "admin"], "admin")).toBe(true);
    expect(hasRole(["manager"], "admin")).toBe(false);
  });
});

describe("nav guards", () => {
  it("hides board and ads from telecallers", () => {
    expect(isTelecallerFocused(["telecaller"])).toBe(true);
    expect(canSeeCompanyNavItem(["telecaller"], "board")).toBe(false);
    expect(canSeeCompanyNavItem(["telecaller"], "leads")).toBe(true);
    expect(canSeeCompanyNavItem(["telecaller"], "calls")).toBe(true);
    expect(canSeeGlobalNav(["telecaller"], "vault")).toBe(false);
    expect(canSeeGlobalNav(["telecaller"], "settings")).toBe(false);
  });

  it("lets managers open settings but not admin", () => {
    expect(canSeeGlobalNav(["manager"], "settings")).toBe(true);
    expect(canSeeGlobalNav(["manager"], "admin")).toBe(false);
  });

  it("does not treat designer+telecaller as telecaller-focused", () => {
    expect(isTelecallerFocused(["telecaller", "designer"])).toBe(false);
    expect(canSeeCompanyNavItem(["telecaller", "designer"], "board")).toBe(true);
  });
});

describe("webhook secret compare", () => {
  it("rejects missing secrets", () => {
    expect(verifyWebhookSecret(null, "abc")).toBe(false);
    expect(verifyWebhookSecret("abc", undefined)).toBe(false);
  });

  it("accepts matching secrets", () => {
    expect(verifyWebhookSecret("token", "token")).toBe(true);
    expect(verifyWebhookSecret("token", "other")).toBe(false);
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
