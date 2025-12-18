import { cors, handleOptions, requireAuth } from '../_lib/middleware.js';
import { deleteMetaToken } from '../_lib/db.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const userId = await requireAuth(req, res);
    if (!userId) return;

    await deleteMetaToken(userId);

    return res.status(200).json({ 
      success: true, 
      message: 'Desconectado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao desconectar:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
