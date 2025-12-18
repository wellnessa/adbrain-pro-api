import { cors, handleOptions } from '../_lib/middleware.js';
import sql from '../_lib/db.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, error: 'Email, código e nova senha são obrigatórios' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Senha deve ter no mínimo 6 caracteres' });
    }

    // Buscar usuário com código válido
    const users = await sql`
      SELECT id, reset_code, reset_code_expires 
      FROM users 
      WHERE email = ${email.toLowerCase()}
    `;

    if (users.length === 0) {
      return res.status(400).json({ success: false, error: 'Email não encontrado' });
    }

    const user = users[0];

    // Verificar código
    if (user.reset_code !== code) {
      return res.status(400).json({ success: false, error: 'Código inválido' });
    }

    // Verificar expiração
    if (new Date() > new Date(user.reset_code_expires)) {
      return res.status(400).json({ success: false, error: 'Código expirado. Solicite um novo.' });
    }

    // Criptografar nova senha
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);

    // Atualizar senha e limpar código
    await sql`
      UPDATE users 
      SET password_hash = ${passwordHash},
          reset_code = NULL,
          reset_code_expires = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${user.id}
    `;

    return res.status(200).json({ 
      success: true, 
      message: 'Senha alterada com sucesso!' 
    });

  } catch (error) {
    console.error('Erro no reset-password:', error);
    return res.status(500).json({ success: false, error: 'Erro interno do servidor' });
  }
}
