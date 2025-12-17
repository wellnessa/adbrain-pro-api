import { cors, handleOptions } from '../_lib/middleware.js';
import sql, { initDatabase } from '../_lib/db.js';

export default async function handler(req, res) {
  cors(req, res);
  if (handleOptions(req, res)) return;

  // Proteção: só pode ser chamado com a chave secreta
  const authKey = req.headers['x-init-key'];
  if (authKey !== process.env.JWT_SECRET) {
    return res.status(403).json({ success: false, error: 'Não autorizado' });
  }

  try {
    // Criar tabela de usuários
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        plan VARCHAR(50) DEFAULT 'trial',
        meta_token TEXT,
        meta_token_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    return res.status(200).json({
      success: true,
      message: 'Banco de dados inicializado com sucesso!'
    });

  } catch (error) {
    console.error('Erro ao inicializar banco:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
