import jwt from 'jsonwebtoken';

const SEGREDO = process.env.JWT_SECRET;

if (!SEGREDO) {
  console.warn('⚠ JWT_SECRET não configurado. Login não vai funcionar.');
}

export function gerarToken(usuario) {
  return jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    SEGREDO,
    { expiresIn: '12h' }
  );
}

export function exigirLogin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  try {
    req.usuario = jwt.verify(token, SEGREDO);
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Sessão expirada, entre de novo' });
  }
}

export function exigirAdmin(req, res, next) {
  if (req.usuario?.perfil !== 'admin') {
    return res.status(403).json({ erro: 'Só administradores podem fazer isso' });
  }
  next();
}
