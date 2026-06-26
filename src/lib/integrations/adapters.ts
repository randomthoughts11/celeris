/**
 * Integration service interfaces for Google Ads, Meta Ads, RingCentral, and Social platforms.
 * Each adapter implements sync methods called by background jobs or webhooks.
 */

export interface SyncResult {
  success: boolean;
  recordsSynced: number;
  error?: string;
}

export interface GoogleAdsAdapter {
  syncCampaigns(companyId: string): Promise<SyncResult>;
  syncAdGroups(campaignId: string): Promise<SyncResult>;
  syncKeywords(adGroupId: string): Promise<SyncResult>;
}

export interface MetaAdsAdapter {
  syncCampaigns(companyId: string): Promise<SyncResult>;
  syncAdSets(campaignId: string): Promise<SyncResult>;
  syncAds(adSetId: string): Promise<SyncResult>;
}

export interface RingCentralAdapter {
  syncCalls(companyId: string, since?: Date): Promise<SyncResult>;
  handleWebhook(payload: unknown): Promise<void>;
}

export interface SocialAdapter {
  syncMetrics(companyId: string, platform: string): Promise<SyncResult>;
  publishPost(postId: string): Promise<SyncResult>;
}

// Placeholder implementations — replace with real API clients when credentials are configured
export const googleAdsAdapter: GoogleAdsAdapter = {
  async syncCampaigns() {
    return { success: true, recordsSynced: 0 };
  },
  async syncAdGroups() {
    return { success: true, recordsSynced: 0 };
  },
  async syncKeywords() {
    return { success: true, recordsSynced: 0 };
  },
};

export const metaAdsAdapter: MetaAdsAdapter = {
  async syncCampaigns() {
    return { success: true, recordsSynced: 0 };
  },
  async syncAdSets() {
    return { success: true, recordsSynced: 0 };
  },
  async syncAds() {
    return { success: true, recordsSynced: 0 };
  },
};

export const ringCentralAdapter: RingCentralAdapter = {
  async syncCalls() {
    return { success: true, recordsSynced: 0 };
  },
  async handleWebhook() {
    // Process incoming call events
  },
};

export const socialAdapter: SocialAdapter = {
  async syncMetrics() {
    return { success: true, recordsSynced: 0 };
  },
  async publishPost() {
    return { success: true, recordsSynced: 1 };
  },
};
