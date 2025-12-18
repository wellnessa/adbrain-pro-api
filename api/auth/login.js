import { cors, handleOptions } from '../_lib/middleware.js';
import { loginUser, getMetaToken } from '../_lib/db.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
    }

    const result = await loginUser(email, password);
    
    if (!result.success) {
      return res.status(401).json(result);
    }

    // Verificar se tem token Meta salvo
    const metaToken = await getMetaToken(result.user.id);
    
    return res.status(200).json({
      success: true,
      user: result.user,
      token: result.token,
      hasMetaToken: metaToken.success
    });
  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
