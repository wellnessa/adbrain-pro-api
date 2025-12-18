import { cors, handleOptions, getAuthHeader } from '../_lib/middleware.js';
import { verifyToken, saveMetaToken } from '../_lib/db.js';
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

    // Verificar se tem JWT do usuário logado para salvar o token
    let tokenSaved = false;
    const jwtToken = getAuthHeader(req);
    
    if (jwtToken) {
      // Verificar se o JWT é válido (não é um token Meta)
      if (jwtToken.split('.').length === 3 && jwtToken.length < 200) {
        const verification = await verifyToken(jwtToken);
        if (verification.valid) {
          // Salvar o token Meta no banco de dados
          const saveResult = await saveMetaToken(verification.userId, accessToken);
          tokenSaved = saveResult.success;
        }
      }
    }

    return res.status(200).json({
      success: true,
      user: {
        id: userData.id,
        name: userData.name
      },
      tokenSaved,
      message: tokenSaved ? 'Conectado e salvo com sucesso!' : 'Conectado com sucesso!'
    });
  } catch (error) {
    console.error('Erro ao conectar Meta:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
