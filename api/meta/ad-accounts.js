import { cors, handleOptions, requireToken } from '../_lib/middleware.js';
import metaApi from '../_lib/meta-api.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const accessToken = requireToken(req, res);
  if (!accessToken) return;

  try {
    const data = await metaApi.getAdAccounts(accessToken);
    
    if (data.error) {
      return res.status(400).json({ success: false, error: data.error.message });
    }

    const adAccounts = (data.data || []).map(account => ({
      id: account.id,
      accountId: account.id.replace('act_', ''),
      name: account.name || account.business_name || account.id,
      status: account.account_status,
      statusLabel: getAccountStatusLabel(account.account_status),
      currency: account.currency,
      amountSpent: account.amount_spent ? parseFloat(account.amount_spent) / 100 : 0
    }));

    return res.status(200).json({ 
      success: true, 
      adAccounts,
      total: adAccounts.length
    });
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}

function getAccountStatusLabel(status) {
  const labels = {
    1: 'Ativa',
    2: 'Desativada',
    3: 'Não definida',
    7: 'Pendente revisão',
    8: 'Pendente encerramento',
    9: 'Em período de carência',
    100: 'Pendente aprovação',
    101: 'Desativada por violação',
    201: 'Desativada por inadimplência'
  };
  return labels[status] || 'Desconhecido';
}
