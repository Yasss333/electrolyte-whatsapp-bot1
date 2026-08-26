const { verifyToken } = require('../auth');

function requireAuth(req, res, next) {
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.admin = verifyToken(match[1]);
    next();
  } catch {
    res.status(401).json({ error: 'Your session is invalid or has expired.' });
  }
}

module.exports = { requireAuth };
