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
    const { email, password, name } = req.body;

    // Validações
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email e senha são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    // Verificar se email já existe
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email.toLowerCase()}
    `;

    if (existingUser.length > 0) {
      return res.status(400).json({ success: false, error: 'Este email já está cadastrado' });
    }

    // Criptografar senha
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const result = await sql`
      INSERT INTO users (email, password_hash, name, plan)
      VALUES (${email.toLowerCase()}, ${passwordHash}, ${name || email.split('@')[0]}, 'trial')
      RETURNING id, email, name, plan, created_at
    `;

    const user = result[0];

    // Gerar JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(201).json({
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
    console.error('Erro no registro:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
