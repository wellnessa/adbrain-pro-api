import { cors, handleOptions, requireAuth } from '../_lib/middleware.js';
import { getMetaToken } from '../_lib/db.js';
import metaApi from '../_lib/meta-api.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    const tokenData = await getMetaToken(userId);
    
    if (!tokenData.success) {
      return res.status(200).json({ 
        success: false, 
        connected: false,
        error: 'Nenhum token Meta salvo' 
      });
    }

    // Verificar se o token ainda é válido com a API do Meta
    const userData = await metaApi.getMe(tokenData.accessToken);
    
    if (userData.error) {
      return res.status(200).json({ 
        success: false, 
        connected: false,
        error: 'Token expirado ou inválido' 
      });
    }

    return res.status(200).json({
      success: true,
      connected: true,
      accessToken: tokenData.accessToken,
      user: {
        id: userData.id,
        name: userData.name
      }
    });
  } catch (error) {
    console.error('Erro ao buscar token:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
