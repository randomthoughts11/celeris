import { createHmac } from "crypto";
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
import { verifyWebhookSecret, verifyMetaHubSignature } from "@/lib/integrations/lead-sync";
import {
  foldGoogleCampaignRows,
  metaRoasFromInsights,
} from "@/lib/integrations/ads-metrics";

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
    expect(canSeeCompanyNavItem(["telecaller"], "messages")).toBe(true);
    expect(canSeeGlobalNav(["telecaller"], "vault")).toBe(false);
    expect(canSeeGlobalNav(["telecaller"], "settings")).toBe(false);
    expect(canSeeGlobalNav(["telecaller"], "inbox")).toBe(true);
  });

  it("salesperson gets CRM desk items", () => {
    expect(isTelecallerFocused(["salesperson"])).toBe(true);
    expect(canSeeCompanyNavItem(["salesperson"], "customers")).toBe(true);
    expect(canSeeCompanyNavItem(["salesperson"], "pipeline")).toBe(true);
    expect(canSeeCompanyNavItem(["salesperson"], "appointments")).toBe(true);
    expect(canSeeCompanyNavItem(["salesperson"], "board")).toBe(false);
    expect(hasPermission(["salesperson"], "ACCESS_CUSTOMERS")).toBe(true);
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

  it("verifies Meta hub signatures", () => {
    const body = '{"object":"page"}';
    const secret = "app-secret";
    const hex = createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyMetaHubSignature(body, `sha256=${hex}`, secret)).toBe(true);
    expect(verifyMetaHubSignature(body, `sha256=${hex}`, undefined)).toBe(false);
    expect(verifyMetaHubSignature(body, null, secret)).toBe(false);
    expect(verifyMetaHubSignature(body, "sha256=deadbeef", secret)).toBe(false);
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

describe("ads metric folding", () => {
  it("sums Google daily rows into one campaign", () => {
    const folded = foldGoogleCampaignRows([
      {
        campaign: { id: "1", name: "Brand", status: "ENABLED" },
        campaignBudget: { amountMicros: "50000000" },
        metrics: {
          costMicros: "10000000",
          clicks: "10",
          impressions: "1000",
          conversions: "1",
          conversionsValue: "40",
        },
      },
      {
        campaign: { id: "1", name: "Brand", status: "ENABLED" },
        campaignBudget: { amountMicros: "50000000" },
        metrics: {
          costMicros: "10000000",
          clicks: "10",
          impressions: "1000",
          conversions: "1",
          conversionsValue: "40",
        },
      },
    ]);
    expect(folded).toHaveLength(1);
    expect(folded[0].spend).toBe(20);
    expect(folded[0].clicks).toBe(20);
    expect(folded[0].roas).toBe(4);
    expect(folded[0].dailyBudget).toBe(50);
  });

  it("uses Meta purchase value for ROAS, not lead count", () => {
    const parsed = metaRoasFromInsights({
      spend: "100",
      ctr: "2",
      action_values: [{ action_type: "purchase", value: "250" }],
      actions: [
        { action_type: "lead", value: "10" },
        { action_type: "purchase", value: "2" },
      ],
    });
    expect(parsed.roas).toBe(2.5);
    expect(parsed.conversions).toBe(12);
    expect(parsed.ctr).toBe(0.02);
  });
});
