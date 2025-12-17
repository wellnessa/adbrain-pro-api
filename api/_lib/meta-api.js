// Helper para chamadas à API do Meta
const META_API_VERSION = 'v18.0';
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export const metaApi = {
  // Buscar dados do usuário
  async getMe(accessToken) {
    const url = `${META_API_BASE}/me?fields=id,name&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar contas de anúncio
  async getAdAccounts(accessToken) {
    const url = `${META_API_BASE}/me/adaccounts?fields=id,name,account_status,currency,business_name,amount_spent&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar campanhas
  async getCampaigns(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = [
      'id',
      'name', 
      'status',
      'effective_status',
      'objective',
      'daily_budget',
      'lifetime_budget',
      'budget_remaining',
      'created_time',
      `insights.date_preset(${datePreset}){impressions,clicks,spend,ctr,cpm,frequency,reach,actions,cost_per_action_type,action_values}`
    ].join(',');
    
    const url = `${META_API_BASE}/act_${adAccountId}/campaigns?fields=${fields}&limit=100&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar conjuntos de anúncios
  async getAdSets(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'campaign_id',
      'daily_budget',
      'lifetime_budget',
      'targeting',
      'optimization_goal',
      `insights.date_preset(${datePreset}){impressions,clicks,spend,ctr,cpm,frequency,reach,actions,cost_per_action_type}`
    ].join(',');
    
    const url = `${META_API_BASE}/act_${adAccountId}/adsets?fields=${fields}&limit=100&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar anúncios
  async getAds(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'campaign_id',
      'adset_id',
      'creative{id,name,thumbnail_url,image_url,body,title,call_to_action_type,object_story_spec,asset_feed_spec}',
      `insights.date_preset(${datePreset}){impressions,clicks,spend,ctr,cpm,frequency,reach,actions,cost_per_action_type,action_values}`
    ].join(',');
    
    const url = `${META_API_BASE}/act_${adAccountId}/ads?fields=${fields}&limit=100&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar breakdown por idade e gênero
  async getAgeGenderBreakdown(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = 'impressions,clicks,spend,actions,cost_per_action_type';
    const url = `${META_API_BASE}/act_${adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&breakdowns=age,gender&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar breakdown por dispositivo
  async getDeviceBreakdown(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = 'impressions,clicks,spend,actions,cost_per_action_type';
    const url = `${META_API_BASE}/act_${adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&breakdowns=device_platform&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar breakdown por posicionamento
  async getPlacementBreakdown(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = 'impressions,clicks,spend,actions,cost_per_action_type';
    const url = `${META_API_BASE}/act_${adAccountId}/insights?fields=${fields}&date_preset=${datePreset}&breakdowns=publisher_platform,platform_position&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Atualizar status da campanha
  async updateCampaignStatus(accessToken, campaignId, status) {
    const url = `${META_API_BASE}/${campaignId}?status=${status}&access_token=${accessToken}`;
    const response = await fetch(url, { method: 'POST' });
    return response.json();
  },

  // Atualizar orçamento da campanha
  async updateCampaignBudget(accessToken, campaignId, dailyBudget) {
    const budgetInCents = Math.round(dailyBudget * 100);
    const url = `${META_API_BASE}/${campaignId}?daily_budget=${budgetInCents}&access_token=${accessToken}`;
    const response = await fetch(url, { method: 'POST' });
    return response.json();
  },

  // Atualizar status do conjunto de anúncios
  async updateAdSetStatus(accessToken, adSetId, status) {
    const url = `${META_API_BASE}/${adSetId}?status=${status}&access_token=${accessToken}`;
    const response = await fetch(url, { method: 'POST' });
    return response.json();
  },

  // Atualizar status do anúncio
  async updateAdStatus(accessToken, adId, status) {
    const url = `${META_API_BASE}/${adId}?status=${status}&access_token=${accessToken}`;
    const response = await fetch(url, { method: 'POST' });
    return response.json();
  }
};

export default metaApi;
