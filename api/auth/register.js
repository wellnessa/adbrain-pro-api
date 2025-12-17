import { cors, handleOptions } from '../_lib/middleware.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
    }

    // Em produção, salvar no banco de dados
    const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    
    return res.status(200).json({
      success: true,
      token,
      user: {
        id: Date.now().toString(),
        email,
        name: name || email.split('@')[0],
        plan: 'trial',
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Erro no registro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
