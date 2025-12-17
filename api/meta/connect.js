import { cors, handleOptions } from '../_lib/middleware.js';
import metaApi from '../_lib/meta-api.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { accessToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({ success: false, error: 'Token de acesso é obrigatório' });
    }

    // Validar token com a API do Meta
    const userData = await metaApi.getMe(accessToken);
    
    if (userData.error) {
      return res.status(400).json({ 
        success: false, 
        error: userData.error.message || 'Token inválido ou expirado'
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: userData.id,
        name: userData.name
      },
      message: 'Conectado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao conectar Meta:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
