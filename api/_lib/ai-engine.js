// Motor de IA para análise e recomendações
// Configurações padrão (podem ser customizadas por cliente)
const DEFAULT_CONFIG = {
  ticketMedio: 2600,
  metaCPA: 400,
  metaROAS: 3,
  frequenciaMaxima: 3,
  ctrMinimo: 1,
};

// Calcula o Health Score de uma campanha
export const calculateHealthScore = (campaign, config = DEFAULT_CONFIG) => {
  let score = 100;
  const insights = campaign.insights || {};
  
  // Penaliza CPA alto
  if (insights.cpa > 0) {
    if (insights.cpa > config.metaCPA * 2) score -= 40;
    else if (insights.cpa > config.metaCPA * 1.5) score -= 25;
    else if (insights.cpa > config.metaCPA) score -= 10;
    else score += 10; // Bônus se CPA abaixo da meta
  }
  
  // Penaliza frequência alta
  if (insights.frequency > config.frequenciaMaxima) score -= 20;
  else if (insights.frequency > config.frequenciaMaxima * 0.8) score -= 10;
  
  // Penaliza CTR baixo
  if (insights.ctr < config.ctrMinimo * 0.5) score -= 20;
  else if (insights.ctr < config.ctrMinimo) score -= 10;
  else if (insights.ctr > config.ctrMinimo * 2) score += 10;
  
  // Bônus por ROAS alto
  if (insights.roas >= config.metaROAS * 2) score += 15;
  else if (insights.roas >= config.metaROAS) score += 5;
  else if (insights.roas > 0 && insights.roas < config.metaROAS * 0.5) score -= 15;
  
  // Penaliza se não tem conversões mas gastou
  if (insights.spend > 100 && insights.conversions === 0) score -= 30;
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

// Classifica o status da campanha
export const getStatusClassification = (score) => {
  if (score >= 80) return { status: 'excellent', label: 'Excelente', color: '#10b981' };
  if (score >= 60) return { status: 'good', label: 'Boa', color: '#22c55e' };
  if (score >= 40) return { status: 'attention', label: 'Atenção', color: '#f59e0b' };
  if (score >= 20) return { status: 'warning', label: 'Alerta', color: '#f97316' };
  return { status: 'critical', label: 'Crítico', color: '#ef4444' };
};

// Gera recomendações para uma campanha
export const generateRecommendations = (campaign, config = DEFAULT_CONFIG) => {
  const recommendations = [];
  const insights = campaign.insights || {};
  const score = campaign.healthScore || calculateHealthScore(campaign, config);
  
  // Recomendação: CPA muito alto
  if (insights.cpa > config.metaCPA * 2) {
    recommendations.push({
      id: `cpa-critical-${campaign.id}`,
      type: 'critical',
      priority: 1,
      title: '🚨 CPA Crítico - Ação Urgente',
      description: `CPA de R$${insights.cpa.toFixed(2)} está ${((insights.cpa / config.metaCPA - 1) * 100).toFixed(0)}% acima da meta. Considere pausar e revisar segmentação.`,
      action: 'pause',
      actionLabel: 'Pausar Campanha',
      impact: `Economia potencial: R$${(insights.spend * 0.5).toFixed(2)}/dia`,
      confidence: 95
    });
  } else if (insights.cpa > config.metaCPA) {
    recommendations.push({
      id: `cpa-high-${campaign.id}`,
      type: 'warning',
      priority: 2,
      title: '⚠️ CPA Acima da Meta',
      description: `CPA de R$${insights.cpa.toFixed(2)} está ${((insights.cpa / config.metaCPA - 1) * 100).toFixed(0)}% acima da meta de R$${config.metaCPA}.`,
      action: 'optimize',
      actionLabel: 'Ver Otimizações',
      impact: 'Redução potencial de 15-25% no CPA',
      confidence: 85
    });
  }
  
  // Recomendação: Frequência alta
  if (insights.frequency > config.frequenciaMaxima) {
    recommendations.push({
      id: `freq-high-${campaign.id}`,
      type: 'warning',
      priority: 2,
      title: '🔄 Público Saturado',
      description: `Frequência de ${insights.frequency.toFixed(1)}x indica que o público está vendo os anúncios muitas vezes. Hora de expandir ou trocar.`,
      action: 'expand_audience',
      actionLabel: 'Expandir Público',
      impact: 'Evitar aumento de 20-30% no CPA',
      confidence: 88
    });
  }
  
  // Recomendação: Campanha excelente - escalar
  if (insights.cpa > 0 && insights.cpa < config.metaCPA * 0.7 && insights.spend > 50 && score >= 80) {
    recommendations.push({
      id: `scale-${campaign.id}`,
      type: 'opportunity',
      priority: 1,
      title: '🚀 Oportunidade de Escala',
      description: `CPA excelente de R$${insights.cpa.toFixed(2)}! Esta campanha está pronta para escalar.`,
      action: 'scale',
      actionLabel: 'Escalar 25%',
      impact: `+${Math.ceil(insights.conversions * 0.25)} conversões potenciais`,
      confidence: 90
    });
  }
  
  // Recomendação: CTR baixo
  if (insights.ctr < config.ctrMinimo * 0.5 && insights.impressions > 1000) {
    recommendations.push({
      id: `ctr-low-${campaign.id}`,
      type: 'warning',
      priority: 3,
      title: '📉 CTR Muito Baixo',
      description: `CTR de ${insights.ctr.toFixed(2)}% está abaixo do esperado. Os criativos podem não estar ressonando com o público.`,
      action: 'review_creatives',
      actionLabel: 'Revisar Criativos',
      impact: 'Aumento potencial de 50-100% no CTR',
      confidence: 82
    });
  }
  
  // Recomendação: Sem conversões com gasto alto
  if (insights.spend > 200 && insights.conversions === 0) {
    recommendations.push({
      id: `no-conv-${campaign.id}`,
      type: 'critical',
      priority: 1,
      title: '🛑 Sem Conversões',
      description: `Já gastou R$${insights.spend.toFixed(2)} sem nenhuma conversão. Recomendamos pausar e revisar toda a estratégia.`,
      action: 'pause',
      actionLabel: 'Pausar Campanha',
      impact: `Evitar mais R$${insights.spend.toFixed(2)} em desperdício`,
      confidence: 92
    });
  }
  
  // Ordenar por prioridade
  recommendations.sort((a, b) => a.priority - b.priority);
  
  return recommendations;
};

// Calcula métricas agregadas
export const calculateAggregatedMetrics = (campaigns, config = DEFAULT_CONFIG) => {
  const totals = {
    spend: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue: 0,
    reach: 0
  };
  
  campaigns.forEach(campaign => {
    const insights = campaign.insights || {};
    totals.spend += insights.spend || 0;
    totals.impressions += insights.impressions || 0;
    totals.clicks += insights.clicks || 0;
    totals.conversions += insights.conversions || 0;
    totals.revenue += insights.revenue || (insights.conversions || 0) * config.ticketMedio;
    totals.reach += insights.reach || 0;
  });
  
  return {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions * 100) : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions * 1000) : 0,
    cpa: totals.conversions > 0 ? (totals.spend / totals.conversions) : 0,
    roas: totals.spend > 0 ? (totals.revenue / totals.spend) : 0,
    profit: totals.revenue - totals.spend,
    avgHealthScore: campaigns.length > 0 
      ? Math.round(campaigns.reduce((sum, c) => sum + (c.healthScore || 0), 0) / campaigns.length)
      : 0
  };
};

// Gera análise de funil
export const analyzeFunnel = (campaigns) => {
  const funnel = {
    topo: { campaigns: [], spend: 0, results: 0 },
    meio: { campaigns: [], spend: 0, results: 0 },
    fundo: { campaigns: [], spend: 0, results: 0 }
  };
  
  campaigns.forEach(campaign => {
    const objective = campaign.objective?.toLowerCase() || '';
    const name = campaign.name?.toLowerCase() || '';
    const insights = campaign.insights || {};
    
    // Classificar por objetivo ou nome
    if (objective.includes('awareness') || objective.includes('reach') || name.includes('topo') || name.includes('alcance')) {
      funnel.topo.campaigns.push(campaign);
      funnel.topo.spend += insights.spend || 0;
      funnel.topo.results += insights.reach || 0;
    } else if (objective.includes('traffic') || objective.includes('engagement') || name.includes('meio') || name.includes('trafego')) {
      funnel.meio.campaigns.push(campaign);
      funnel.meio.spend += insights.spend || 0;
      funnel.meio.results += insights.clicks || 0;
    } else {
      funnel.fundo.campaigns.push(campaign);
      funnel.fundo.spend += insights.spend || 0;
      funnel.fundo.results += insights.conversions || 0;
    }
  });
  
  const totalSpend = funnel.topo.spend + funnel.meio.spend + funnel.fundo.spend;
  
  return {
    topo: {
      ...funnel.topo,
      percentage: totalSpend > 0 ? (funnel.topo.spend / totalSpend * 100) : 0,
      idealPercentage: 20
    },
    meio: {
      ...funnel.meio,
      percentage: totalSpend > 0 ? (funnel.meio.spend / totalSpend * 100) : 0,
      idealPercentage: 30
    },
    fundo: {
      ...funnel.fundo,
      percentage: totalSpend > 0 ? (funnel.fundo.spend / totalSpend * 100) : 0,
      idealPercentage: 50
    },
    totalSpend
  };
};

export default {
  calculateHealthScore,
  getStatusClassification,
  generateRecommendations,
  calculateAggregatedMetrics,
  analyzeFunnel,
  DEFAULT_CONFIG
};
