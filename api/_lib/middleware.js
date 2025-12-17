// Middleware de CORS para todas as rotas
export const cors = (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Extrai o token Meta do header
export const getMetaToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.replace('Bearer ', '');
};

// Handler padrão para OPTIONS
export const handleOptions = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
};

// Verifica se tem token
export const requireToken = (req, res) => {
  const token = getMetaToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: 'Token não fornecido. Conecte sua conta Meta.' });
    return null;
  }
  return token;
};
