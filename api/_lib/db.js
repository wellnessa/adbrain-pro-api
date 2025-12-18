import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Conexão com o banco de dados
const sql = neon(process.env.DATABASE_URL);

export default sql;

const JWT_SECRET = process.env.JWT_SECRET || 'adbrain-secret-key-2024';

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
    
    // Criar tabela de códigos de reset de senha (se não existir)
    await sql`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('Tabelas criadas com sucesso!');
    return { success: true };
  } catch (error) {
    console.error('Erro ao criar tabelas:', error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// AUTH - Funções de autenticação
// =============================================================================

export async function createUser(name, email, password) {
  await initDatabase();
  const hashedPassword = await bcrypt.hash(password, 10);
  
  try {
    const result = await sql`
      INSERT INTO users (name, email, password_hash)
      VALUES (${name}, ${email}, ${hashedPassword})
      RETURNING id, name, email, created_at
    `;
    return { success: true, user: result[0] };
  } catch (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Email já cadastrado' };
    }
    throw error;
  }
}

export async function loginUser(email, password) {
  await initDatabase();
  
  const users = await sql`SELECT * FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return { success: false, error: 'Email ou senha incorretos' };
  }
  
  const user = users[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);
  if (!validPassword) {
    return { success: false, error: 'Email ou senha incorretos' };
  }
  
  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  
  return {
    success: true,
    user: { id: user.id, name: user.name, email: user.email },
    token,
    hasMetaToken: !!user.meta_token
  };
}

export async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, userId: decoded.userId, email: decoded.email };
  } catch {
    return { valid: false };
  }
}

// =============================================================================
// PASSWORD RESET - Funções de reset de senha
// =============================================================================

export async function createResetCode(email) {
  await initDatabase();
  
  const users = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return { success: false, error: 'Email não encontrado' };
  }
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
  
  await sql`
    INSERT INTO password_resets (email, code, expires_at)
    VALUES (${email}, ${code}, ${expiresAt})
  `;
  
  return { success: true, code };
}

export async function verifyResetCode(email, code) {
  const resets = await sql`
    SELECT * FROM password_resets 
    WHERE email = ${email} AND code = ${code} AND used = FALSE AND expires_at > NOW()
    ORDER BY created_at DESC LIMIT 1
  `;
  
  if (resets.length === 0) {
    return { success: false, error: 'Código inválido ou expirado' };
  }
  
  return { success: true, resetId: resets[0].id };
}

export async function resetPassword(email, code, newPassword) {
  const verification = await verifyResetCode(email, code);
  if (!verification.success) {
    return verification;
  }
  
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  await sql`UPDATE users SET password_hash = ${hashedPassword}, updated_at = NOW() WHERE email = ${email}`;
  await sql`UPDATE password_resets SET used = TRUE WHERE id = ${verification.resetId}`;
  
  return { success: true };
}

// =============================================================================
// META TOKEN - Funções para salvar/buscar token do Meta
// =============================================================================

// Criptografia simples para o token (XOR com chave)
function encryptToken(token) {
  const key = process.env.ENCRYPTION_KEY || 'adbrain-encryption-key-2024';
  let encrypted = '';
  for (let i = 0; i < token.length; i++) {
    encrypted += String.fromCharCode(token.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return Buffer.from(encrypted).toString('base64');
}

function decryptToken(encrypted) {
  const key = process.env.ENCRYPTION_KEY || 'adbrain-encryption-key-2024';
  const decoded = Buffer.from(encrypted, 'base64').toString();
  let decrypted = '';
  for (let i = 0; i < decoded.length; i++) {
    decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return decrypted;
}

// Salvar token Meta do usuário
export async function saveMetaToken(userId, accessToken) {
  await initDatabase();
  
  const tokenEncrypted = encryptToken(accessToken);
  // Token do Meta geralmente expira em 60 dias
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  
  try {
    await sql`
      UPDATE users 
      SET meta_token = ${tokenEncrypted}, 
          meta_token_expires_at = ${expiresAt},
          updated_at = NOW()
      WHERE id = ${userId}
    `;
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar token:', error);
    return { success: false, error: 'Erro ao salvar token' };
  }
}

// Buscar token Meta do usuário
export async function getMetaToken(userId) {
  await initDatabase();
  
  const users = await sql`
    SELECT meta_token, meta_token_expires_at 
    FROM users 
    WHERE id = ${userId}
  `;
  
  if (users.length === 0 || !users[0].meta_token) {
    return { success: false, error: 'Token não encontrado' };
  }
  
  // Verificar se expirou
  if (users[0].meta_token_expires_at && new Date(users[0].meta_token_expires_at) < new Date()) {
    return { success: false, error: 'Token expirado' };
  }
  
  const accessToken = decryptToken(users[0].meta_token);
  
  return {
    success: true,
    accessToken
  };
}

// Deletar token Meta do usuário
export async function deleteMetaToken(userId) {
  await initDatabase();
  
  await sql`
    UPDATE users 
    SET meta_token = NULL, 
        meta_token_expires_at = NULL,
        updated_at = NOW()
    WHERE id = ${userId}
  `;
  
  return { success: true };
}

// Buscar usuário por ID
export async function getUserById(userId) {
  const users = await sql`SELECT id, name, email, plan, created_at FROM users WHERE id = ${userId}`;
  if (users.length === 0) {
    return null;
  }
  return users[0];
}

export { sql };
