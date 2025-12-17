// =============================================================================
// MIDDLEWARE SEGURO PARA PRODUÇÃO
// =============================================================================

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

// Extrai o token Meta do header Authorization
export const getMetaToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
};

// Verifica se tem token e retorna ou envia erro
export const requireToken = (req, res) => {
  const token = getMetaToken(req);
  if (!token) {
    res.status(401).json({ 
      success: false, 
      error: 'Token não fornecido. Conecte sua conta Meta.' 
    });
    return null;
  }
  return token;
};

// Rate limiting simples (opcional mas recomendado)
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
