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

  // Buscar anúncios - CORRIGIDO: busca thumbnail separadamente se necessário
  async getAds(accessToken, adAccountId, datePreset = 'last_30d') {
    const fields = [
      'id',
      'name',
      'status',
      'effective_status',
      'campaign_id',
      'adset_id',
      'preview_shareable_link',
      // Creative com TODOS os campos possíveis de imagem
      'creative{id,name,thumbnail_url,image_url,image_hash,body,title,call_to_action_type,object_story_spec,asset_feed_spec,effective_object_story_id,object_type,instagram_permalink_url,object_story_id}',
      `insights.date_preset(${datePreset}){impressions,clicks,spend,ctr,cpm,frequency,reach,actions,cost_per_action_type,action_values}`
    ].join(',');
    
    const url = `${META_API_BASE}/act_${adAccountId}/ads?fields=${fields}&limit=100&access_token=${accessToken}`;
    const response = await fetch(url);
    return response.json();
  },

  // Buscar thumbnail do creative diretamente
  async getCreativeThumbnail(accessToken, creativeId) {
    try {
      const url = `${META_API_BASE}/${creativeId}?fields=thumbnail_url,image_url,object_story_spec{link_data{image_url,picture},video_data{image_url},photo_data{url,image_url}}&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) return null;
      
      // Tentar várias fontes de imagem
      let imageUrl = data.thumbnail_url || data.image_url || null;
      
      if (!imageUrl && data.object_story_spec) {
        const spec = data.object_story_spec;
        if (spec.link_data) {
          imageUrl = spec.link_data.image_url || spec.link_data.picture;
        }
        if (!imageUrl && spec.video_data) {
          imageUrl = spec.video_data.image_url;
        }
        if (!imageUrl && spec.photo_data) {
          imageUrl = spec.photo_data.url || spec.photo_data.image_url;
        }
      }
      
      return imageUrl;
    } catch (e) {
      console.error('Erro ao buscar thumbnail:', e);
      return null;
    }
  },

  // Buscar detalhes do post do Instagram/Facebook
  async getMediaDetails(accessToken, mediaId) {
    try {
      // Tentar buscar como post do Instagram
      const igUrl = `${META_API_BASE}/${mediaId}?fields=id,media_type,media_url,thumbnail_url,permalink&access_token=${accessToken}`;
      const igResponse = await fetch(igUrl);
      const igData = await igResponse.json();
      
      if (!igData.error && (igData.media_url || igData.thumbnail_url)) {
        return igData;
      }
      
      // Tentar buscar como post do Facebook
      const fbUrl = `${META_API_BASE}/${mediaId}?fields=id,full_picture,picture,source,permalink_url&access_token=${accessToken}`;
      const fbResponse = await fetch(fbUrl);
      return fbResponse.json();
    } catch (e) {
      console.error('Erro ao buscar mídia:', e);
      return null;
    }
  },

  // Buscar imagem do post (story) do Facebook/Instagram
  async getStoryImage(accessToken, storyId) {
    try {
      const url = `${META_API_BASE}/${storyId}?fields=full_picture,picture,source,attachments{media{image{src}}}&access_token=${accessToken}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) return null;
      
      let imageUrl = data.full_picture || data.picture || null;
      
      if (!imageUrl && data.attachments?.data?.[0]?.media?.image?.src) {
        imageUrl = data.attachments.data[0].media.image.src;
      }
      
      return imageUrl;
    } catch (e) {
      console.error('Erro ao buscar story:', e);
      return null;
    }
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
