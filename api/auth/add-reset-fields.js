import { cors, handleOptions } from '../_lib/middleware.js';
import sql from '../_lib/db.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  const authKey = req.headers['x-init-key'];
  if (authKey !== process.env.JWT_SECRET) {
    return res.status(403).json({ success: false, error: 'Não autorizado' });
  }

  try {
    await sql`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS reset_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS reset_code_expires TIMESTAMP
    `;

    return res.status(200).json({
      success: true,
      message: 'Campos de reset adicionados com sucesso!'
    });

  } catch (error) {
    console.error('Erro:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
