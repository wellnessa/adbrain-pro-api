// =============================================================================
// MIDDLEWARE SEGURO PARA PRODUÇÃO
// =============================================================================

import { verifyToken, getMetaToken } from './db.js';

// Lista de origens permitidas
const allowedOrigins = [
  'https://adbrain-pro-frontend.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean);

// Middleware de CORS seguro
export const cors = (req, res) => {
  const origin = req.headers.origin;
  
  // Verifica se a origem está na lista permitida
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV !== 'production') {
    // Em desenvolvimento, permite qualquer origem
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Handler padrão para OPTIONS (preflight)
export const handleOptions = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
};

// Extrai o token do header Authorization
export const getAuthHeader = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
};

// Extrai o token Meta do header Authorization (modo legado - token direto)
export const getMetaTokenFromHeader = (req) => {
  const token = getAuthHeader(req);
  if (!token) return null;
  
  // Se o token tem 3 partes com pontos e é curto, é um JWT (não token Meta)
  if (token.split('.').length === 3 && token.length < 200) {
    return null;
  }
  
  // Se o token é longo (>100 chars), provavelmente é um token Meta
  if (token.length > 100) {
    return token;
  }
  
  return null;
};

// Verifica se tem token Meta direto no header e retorna ou envia erro
// MANTIDO PARA COMPATIBILIDADE
export const requireToken = (req, res) => {
  const token = getMetaTokenFromHeader(req);
  if (!token) {
    res.status(401).json({ 
      success: false, 
      error: 'Token não fornecido. Conecte sua conta Meta.' 
    });
    return null;
  }
  return token;
};

// Alias para compatibilidade
export const getMetaToken_legacy = getMetaTokenFromHeader;

// =============================================================================
// NOVAS FUNÇÕES DE AUTENTICAÇÃO JWT
// =============================================================================

// Verifica autenticação JWT e retorna userId
export const requireAuth = async (req, res) => {
  const token = getAuthHeader(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Token de autenticação não fornecido' });
    return null;
  }
  
  const verification = await verifyToken(token);
  if (!verification.valid) {
    res.status(401).json({ success: false, error: 'Token inválido ou expirado' });
    return null;
  }
  
  return verification.userId;
};

// Busca o token Meta do usuário autenticado (do banco de dados)
export const requireMetaTokenFromDB = async (req, res) => {
  const userId = await requireAuth(req, res);
  if (!userId) return null;
  
  const tokenData = await getMetaToken(userId);
  if (!tokenData.success) {
    res.status(401).json({ success: false, error: 'Conecte sua conta Meta primeiro' });
    return null;
  }
  
  return {
    userId,
    accessToken: tokenData.accessToken
  };
};

// Middleware híbrido - tenta pegar token do header OU do banco
// Prioriza token do header (modo legado) para compatibilidade
export const getMetaAccessToken = async (req, res) => {
  // Primeiro tenta o modo legado (token Meta direto no header)
  const legacyToken = getMetaTokenFromHeader(req);
  if (legacyToken) {
    return { accessToken: legacyToken, userId: null };
  }
  
  // Senão, tenta o modo novo (JWT + token salvo no banco)
  const result = await requireMetaTokenFromDB(req, res);
  return result;
};

// =============================================================================
// RATE LIMITING
// =============================================================================

const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX = 100; // máximo de requisições por minuto

export const rateLimit = (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, startTime: now });
    return true;
  }
  
  const record = requestCounts.get(ip);
  
  if (now - record.startTime > RATE_LIMIT_WINDOW) {
    // Reset da janela
    requestCounts.set(ip, { count: 1, startTime: now });
    return true;
  }
  
  record.count++;
  
  if (record.count > RATE_LIMIT_MAX) {
    res.status(429).json({ 
      success: false, 
      error: 'Muitas requisições. Tente novamente em 1 minuto.' 
    });
    return false;
  }
  
  return true;
};

// Limpa registros antigos de rate limit periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now - record.startTime > RATE_LIMIT_WINDOW * 2) {
      requestCounts.delete(ip);
    }
  }
}, RATE_LIMIT_WINDOW);
