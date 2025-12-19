import { cors, handleOptions, requireToken } from '../../_lib/middleware.js';
import metaApi from '../../_lib/meta-api.js';
import aiEngine from '../../_lib/ai-engine.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const accessToken = requireToken(req, res);
  if (!accessToken) return;

  const { adAccountId, date_preset = 'last_30d' } = req.query;
  const cleanId = adAccountId.replace('act_', '');

  try {
    const data = await metaApi.getAds(accessToken, cleanId, date_preset);
    
    if (data.error) {
      console.error('[ADS API] Error:', data.error);
      return res.status(400).json({ success: false, error: data.error.message });
    }

    if (!data.data || data.data.length === 0) {
      return res.status(200).json({ success: true, ads: [], total: 0 });
    }

    // Processar anúncios
    const ads = await Promise.all(data.data.map(async (ad) => {
      const insightsData = ad.insights?.data?.[0] || {};
      const creative = ad.creative || {};
      
      // Extrair métricas
      const metrics = {
        impressions: parseInt(insightsData.impressions || 0),
        clicks: parseInt(insightsData.clicks || 0),
        spend: parseFloat(insightsData.spend || 0),
        ctr: parseFloat(insightsData.ctr || 0),
        cpm: parseFloat(insightsData.cpm || 0),
        frequency: parseFloat(insightsData.frequency || 0),
        reach: parseInt(insightsData.reach || 0),
        conversions: 0,
        cpa: 0,
        revenue: 0,
        roas: 0
      };
      
      // Extrair conversões
      if (insightsData.actions) {
        const conversionTypes = ['purchase', 'omni_purchase', 'lead', 'onsite_conversion.lead_grouped', 'complete_registration', 'contact', 'submit_application'];
        for (const type of conversionTypes) {
          const action = insightsData.actions.find(a => a.action_type === type);
          if (action) {
            metrics.conversions = parseInt(action.value || 0);
            break;
          }
        }
      }
      
      // Extrair CPA
      if (insightsData.cost_per_action_type) {
        const cpaTypes = ['purchase', 'omni_purchase', 'lead', 'complete_registration', 'contact'];
        for (const type of cpaTypes) {
          const costAction = insightsData.cost_per_action_type.find(a => a.action_type === type);
          if (costAction) {
            metrics.cpa = parseFloat(costAction.value || 0);
            break;
          }
        }
      }
      
      // Calcular CPA se não encontrou
      if (metrics.cpa === 0 && metrics.conversions > 0 && metrics.spend > 0) {
        metrics.cpa = metrics.spend / metrics.conversions;
      }
      
      // Extrair receita
      if (insightsData.action_values) {
        const revenueAction = insightsData.action_values.find(a => 
          a.action_type === 'purchase' || a.action_type === 'omni_purchase'
        );
        if (revenueAction) {
          metrics.revenue = parseFloat(revenueAction.value || 0);
        }
      }
      
      // Calcular receita estimada se não tiver
      if (metrics.revenue === 0 && metrics.conversions > 0) {
        metrics.revenue = metrics.conversions * (aiEngine.DEFAULT_CONFIG?.ticketMedio || 500);
      }
      
      // Calcular ROAS
      if (metrics.spend > 0 && metrics.revenue > 0) {
        metrics.roas = metrics.revenue / metrics.spend;
      }
      
      // ====== EXTRAÇÃO DE IMAGEM - MÉTODO AGRESSIVO ======
      let imageUrl = null;
      let body = creative.body || '';
      let title = creative.title || '';
      let ctaType = creative.call_to_action_type || '';
      
      // 1. Tentar thumbnail_url ou image_url direto do creative
      imageUrl = creative.thumbnail_url || creative.image_url || null;
      
      // 2. Tentar do object_story_spec (posts de Facebook/Instagram)
      if (!imageUrl && creative.object_story_spec) {
        const spec = creative.object_story_spec;
        
        // Link data (posts com link)
        if (spec.link_data) {
          body = spec.link_data.message || body;
          title = spec.link_data.name || title;
          imageUrl = spec.link_data.image_url || spec.link_data.picture || imageUrl;
          ctaType = spec.link_data.call_to_action?.type || ctaType;
        }
        
        // Video data (posts de vídeo)
        if (!imageUrl && spec.video_data) {
          body = spec.video_data.message || body;
          title = spec.video_data.title || title;
          imageUrl = spec.video_data.image_url || imageUrl;
        }
        
        // Photo data (posts de foto)
        if (!imageUrl && spec.photo_data) {
          body = spec.photo_data.caption || body;
          imageUrl = spec.photo_data.image_url || spec.photo_data.url || imageUrl;
        }
      }
      
      // 3. Tentar do asset_feed_spec (anúncios dinâmicos/carrossel)
      if (!imageUrl && creative.asset_feed_spec) {
        const feed = creative.asset_feed_spec;
        if (feed.images && feed.images.length > 0) {
          imageUrl = feed.images[0].url || feed.images[0].hash;
        }
        if (!imageUrl && feed.videos && feed.videos.length > 0) {
          imageUrl = feed.videos[0].thumbnail_url;
        }
      }
      
      // 4. Se tem creative.id mas não tem imagem, buscar thumbnail diretamente
      if (!imageUrl && creative.id) {
        try {
          const thumbnail = await metaApi.getCreativeThumbnail(accessToken, creative.id);
          if (thumbnail) {
            imageUrl = thumbnail;
          }
        } catch (e) {
          console.error('[ADS API] Error fetching creative thumbnail:', e.message);
        }
      }
      
      // 5. Se tem effective_object_story_id, buscar imagem do post
      if (!imageUrl && creative.effective_object_story_id) {
        try {
          const storyImage = await metaApi.getStoryImage(accessToken, creative.effective_object_story_id);
          if (storyImage) {
            imageUrl = storyImage;
          }
        } catch (e) {
          console.error('[ADS API] Error fetching story image:', e.message);
        }
      }
      
      // 6. Se tem object_story_id, tentar também
      if (!imageUrl && creative.object_story_id) {
        try {
          const storyImage = await metaApi.getStoryImage(accessToken, creative.object_story_id);
          if (storyImage) {
            imageUrl = storyImage;
          }
        } catch (e) {
          console.error('[ADS API] Error fetching object story image:', e.message);
        }
      }
      
      // URL do Instagram como fallback informativo
      const instagramUrl = creative.instagram_permalink_url || null;
      
      // Calcular score do anúncio
      let score = 50;
      
      // CTR
      if (metrics.ctr > 3) score += 25;
      else if (metrics.ctr > 2) score += 20;
      else if (metrics.ctr > 1.5) score += 15;
      else if (metrics.ctr > 1) score += 10;
      else if (metrics.ctr < 0.5 && metrics.impressions > 100) score -= 15;
      
      // CPA
      if (metrics.cpa > 0 && metrics.cpa < 200) score += 30;
      else if (metrics.cpa > 0 && metrics.cpa < 300) score += 20;
      else if (metrics.cpa > 0 && metrics.cpa < 400) score += 10;
      else if (metrics.cpa > 500) score -= 20;
      
      // Conversões
      if (metrics.conversions >= 10) score += 15;
      else if (metrics.conversions >= 5) score += 10;
      else if (metrics.conversions > 0) score += 5;
      
      // ROAS
      if (metrics.roas >= 5) score += 15;
      else if (metrics.roas >= 3) score += 10;
      else if (metrics.roas > 0 && metrics.roas < 1) score -= 10;
      
      // Frequência
      if (metrics.frequency > 4) score -= 15;
      else if (metrics.frequency > 3) score -= 10;
      
      score = Math.max(0, Math.min(100, Math.round(score)));
      
      return {
        id: ad.id,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effective_status,
        campaignId: ad.campaign_id,
        adsetId: ad.adset_id,
        score,
        scoreClassification: aiEngine.getStatusClassification?.(score) || (score >= 70 ? 'good' : score >= 40 ? 'average' : 'poor'),
        previewUrl: ad.preview_shareable_link || null,
        instagramUrl,
        creative: {
          id: creative.id,
          name: creative.name,
          imageUrl,
          body,
          title,
          ctaType,
          objectType: creative.object_type || null
        },
        metrics: {
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          spend: parseFloat(metrics.spend.toFixed(2)),
          ctr: parseFloat(metrics.ctr.toFixed(2)),
          cpm: parseFloat(metrics.cpm.toFixed(2)),
          frequency: parseFloat(metrics.frequency.toFixed(2)),
          reach: metrics.reach,
          conversions: metrics.conversions,
          cpa: parseFloat(metrics.cpa.toFixed(2)),
          revenue: parseFloat(metrics.revenue.toFixed(2)),
          roas: parseFloat(metrics.roas.toFixed(2))
        }
      };
    }));

    // Ordenar por score (melhores primeiro)
    ads.sort((a, b) => b.score - a.score);

    return res.status(200).json({
      success: true,
      ads,
      total: ads.length,
      datePreset: date_preset
    });
  } catch (error) {
    console.error('[ADS API] Error:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor', details: error.message });
  }
}
