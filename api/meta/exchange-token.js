import { cors, handleOptions } from '../_lib/middleware.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const { shortToken } = req.body;

  if (!shortToken) {
    return res.status(400).json({ success: false, error: 'Token não fornecido' });
  }

  // Credenciais do App (usar variáveis de ambiente!)
  const APP_ID = process.env.META_APP_ID;
  const APP_SECRET = process.env.META_APP_SECRET;

  if (!APP_ID || !APP_SECRET) {
    console.error('META_APP_ID ou META_APP_SECRET não configurados');
    return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta' });
  }

  try {
    // Trocar token curto por token de longa duração (60 dias)
    const url = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error('Erro ao trocar token:', data.error);
      return res.status(400).json({ 
        success: false, 
        error: data.error.message || 'Erro ao trocar token' 
      });
    }

    if (!data.access_token) {
      return res.status(400).json({ success: false, error: 'Token não retornado' });
    }

    // Buscar informações do token para confirmar validade
    const debugUrl = `https://graph.facebook.com/debug_token?input_token=${data.access_token}&access_token=${APP_ID}|${APP_SECRET}`;
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();

    let expiresAt = null;
    let expiresIn = null;

    if (debugData.data && debugData.data.expires_at) {
      expiresAt = new Date(debugData.data.expires_at * 1000).toISOString();
      expiresIn = Math.round((debugData.data.expires_at * 1000 - Date.now()) / (1000 * 60 * 60 * 24)); // dias
    }

    return res.status(200).json({
      success: true,
      accessToken: data.access_token,
      tokenType: data.token_type || 'bearer',
      expiresAt,
      expiresInDays: expiresIn || 60,
      message: `Token de longa duração gerado! Válido por ${expiresIn || 60} dias.`
    });

  } catch (error) {
    console.error('Erro ao trocar token:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
