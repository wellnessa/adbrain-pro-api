import { cors, handleOptions } from '../_lib/middleware.js';
import sql from '../_lib/db.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const result = await sql`
      SELECT id, email, password_hash, name, plan, created_at
      FROM users 
      WHERE email = ${email.toLowerCase()}
    `;

    if (result.length === 0) {
      return res.status(401).json({ success: false, error: 'Email ou senha incorretos' });
    }

    const user = result[0];

    // Verificar senha
    const passwordValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({ success: false, error: 'Email ou senha incorretos' });
    }

    // Atualizar último acesso
    await sql`
      UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ${user.id}
    `;

    // Gerar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        createdAt: user.created_at
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
