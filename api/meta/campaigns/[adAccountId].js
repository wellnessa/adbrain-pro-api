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
    const data = await metaApi.getCampaigns(accessToken, cleanId, date_preset);
    
    if (data.error) {
      return res.status(400).json({ success: false, error: data.error.message });
    }

    if (!data.data || data.data.length === 0) {
      return res.status(200).json({ 
        success: true, 
        campaigns: [],
        metrics: aiEngine.calculateAggregatedMetrics([]),
        datePreset: date_preset
      });
    }

    // Processar campanhas
    const campaigns = data.data.map(campaign => {
      const insightsData = campaign.insights?.data?.[0] || {};
      
      // Extrair métricas
      const insights = {
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
        const conversionTypes = ['purchase', 'omni_purchase', 'lead', 'onsite_conversion.lead_grouped', 'complete_registration'];
        for (const type of conversionTypes) {
          const action = insightsData.actions.find(a => a.action_type === type);
          if (action) {
            insights.conversions = parseInt(action.value || 0);
            break;
          }
        }
      }
      
      // Extrair CPA
      if (insightsData.cost_per_action_type) {
        const cpaTypes = ['purchase', 'omni_purchase', 'lead'];
        for (const type of cpaTypes) {
          const costAction = insightsData.cost_per_action_type.find(a => a.action_type === type);
          if (costAction) {
            insights.cpa = parseFloat(costAction.value || 0);
            break;
          }
        }
      }
      
      // Calcular CPA se não encontrou
      if (insights.cpa === 0 && insights.conversions > 0 && insights.spend > 0) {
        insights.cpa = insights.spend / insights.conversions;
      }
      
      // Extrair receita
      if (insightsData.action_values) {
        const revenueAction = insightsData.action_values.find(a => 
          a.action_type === 'purchase' || a.action_type === 'omni_purchase'
        );
        if (revenueAction) {
          insights.revenue = parseFloat(revenueAction.value || 0);
        }
      }
      
      // Calcular receita estimada se não tiver
      if (insights.revenue === 0 && insights.conversions > 0) {
        insights.revenue = insights.conversions * aiEngine.DEFAULT_CONFIG.ticketMedio;
      }
      
      // Calcular ROAS
      if (insights.spend > 0) {
        insights.roas = insights.revenue / insights.spend;
      }
      
      const processedCampaign = {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        effectiveStatus: campaign.effective_status,
        objective: campaign.objective,
        dailyBudget: campaign.daily_budget ? parseInt(campaign.daily_budget) / 100 : null,
        lifetimeBudget: campaign.lifetime_budget ? parseInt(campaign.lifetime_budget) / 100 : null,
        budgetRemaining: campaign.budget_remaining ? parseInt(campaign.budget_remaining) / 100 : null,
        createdTime: campaign.created_time,
        insights
      };
      
      // Calcular Health Score
      processedCampaign.healthScore = aiEngine.calculateHealthScore(processedCampaign);
      processedCampaign.statusClassification = aiEngine.getStatusClassification(processedCampaign.healthScore);
      
      // Gerar recomendações
      processedCampaign.recommendations = aiEngine.generateRecommendations(processedCampaign);
      
      return processedCampaign;
    });

    // Ordenar por Health Score (piores primeiro para ação)
    campaigns.sort((a, b) => a.healthScore - b.healthScore);

    // Calcular métricas agregadas
    const metrics = aiEngine.calculateAggregatedMetrics(campaigns);
    
    // Analisar funil
    const funnel = aiEngine.analyzeFunnel(campaigns);

    // Gerar recomendações gerais
    const allRecommendations = [];
    campaigns.forEach(c => {
      if (c.recommendations) {
        allRecommendations.push(...c.recommendations);
      }
    });

    return res.status(200).json({
      success: true,
      campaigns,
      total: campaigns.length,
      metrics,
      funnel,
      recommendations: allRecommendations.slice(0, 10), // Top 10 recomendações
      datePreset: date_preset
    });
  } catch (error) {
    console.error('Erro ao buscar campanhas:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
