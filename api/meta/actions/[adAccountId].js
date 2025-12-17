import { cors, handleOptions, requireToken } from '../../_lib/middleware.js';
import metaApi from '../../_lib/meta-api.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const accessToken = requireToken(req, res);
  if (!accessToken) return;

  const { adAccountId } = req.query;
  const { action, targetId, targetType, value } = req.body;

  if (!action || !targetId || !targetType) {
    return res.status(400).json({ 
      success: false, 
      error: 'Parâmetros obrigatórios: action, targetId, targetType' 
    });
  }

  try {
    let result;

    switch (action) {
      case 'pause':
        result = await handleStatusChange(accessToken, targetId, targetType, 'PAUSED');
        break;
      
      case 'activate':
        result = await handleStatusChange(accessToken, targetId, targetType, 'ACTIVE');
        break;
      
      case 'scale':
        if (!value || typeof value !== 'number') {
          return res.status(400).json({ success: false, error: 'Valor de escala é obrigatório' });
        }
        result = await handleScale(accessToken, targetId, targetType, value);
        break;
      
      case 'update_budget':
        if (!value || typeof value !== 'number') {
          return res.status(400).json({ success: false, error: 'Novo orçamento é obrigatório' });
        }
        result = await handleBudgetUpdate(accessToken, targetId, value);
        break;
      
      default:
        return res.status(400).json({ success: false, error: 'Ação não reconhecida' });
    }

    if (result.error) {
      return res.status(400).json({ success: false, error: result.error.message });
    }

    return res.status(200).json({
      success: true,
      message: getSuccessMessage(action, targetType),
      result
    });
  } catch (error) {
    console.error('Erro ao executar ação:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

async function handleStatusChange(accessToken, targetId, targetType, status) {
  switch (targetType) {
    case 'campaign':
      return await metaApi.updateCampaignStatus(accessToken, targetId, status);
    case 'adset':
      return await metaApi.updateAdSetStatus(accessToken, targetId, status);
    case 'ad':
      return await metaApi.updateAdStatus(accessToken, targetId, status);
    default:
      throw new Error('Tipo de alvo não suportado');
  }
}

async function handleScale(accessToken, targetId, targetType, percentage) {
  // Primeiro, buscar o orçamento atual
  const url = `https://graph.facebook.com/v18.0/${targetId}?fields=daily_budget,lifetime_budget&access_token=${accessToken}`;
  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    return data;
  }

  const currentBudget = data.daily_budget ? parseInt(data.daily_budget) : parseInt(data.lifetime_budget);
  const newBudget = Math.round(currentBudget * (1 + percentage / 100));

  // Atualizar orçamento
  const budgetField = data.daily_budget ? 'daily_budget' : 'lifetime_budget';
  const updateUrl = `https://graph.facebook.com/v18.0/${targetId}?${budgetField}=${newBudget}&access_token=${accessToken}`;
  const updateResponse = await fetch(updateUrl, { method: 'POST' });
  return await updateResponse.json();
}

async function handleBudgetUpdate(accessToken, targetId, newBudget) {
  const budgetInCents = Math.round(newBudget * 100);
  const url = `https://graph.facebook.com/v18.0/${targetId}?daily_budget=${budgetInCents}&access_token=${accessToken}`;
  const response = await fetch(url, { method: 'POST' });
  return await response.json();
}

function getSuccessMessage(action, targetType) {
  const typeLabels = { campaign: 'Campanha', adset: 'Conjunto', ad: 'Anúncio' };
  const actionLabels = {
    pause: 'pausado(a)',
    activate: 'ativado(a)',
    scale: 'escalado(a)',
    update_budget: 'atualizado(a)'
  };
  return `${typeLabels[targetType]} ${actionLabels[action]} com sucesso!`;
}
