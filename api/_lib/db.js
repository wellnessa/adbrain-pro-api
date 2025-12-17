import { neon } from '@neondatabase/serverless';

// Conexão com o banco de dados
const sql = neon(process.env.DATABASE_URL);

export default sql;

// Função para criar as tabelas necessárias
export async function initDatabase() {
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
    
    console.log('Tabelas criadas com sucesso!');
    return { success: true };
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    return { success: false, error: error.message };
  }
}
