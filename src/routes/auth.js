import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { gerarToken, exigirLogin } from '../middleware/auth.js';

import sso from '../sso-passe.cjs';

const router = express.Router();

// Login único vindo do Ferramentas Fora da Lei (só Eduardo e Gilberto). Passe de 60s, uso único.
// Acha o usuário pelo e-mail configurado; sem e-mail, pelo primeiro nome se só houver um ativo.
const SSO_PADRAO = {
  eduardo: { emails: ['eduardo@foradalei.com.br'], nome: 'Eduardo' },
  gilberto: { emails: ['gilberto@foradalei.com.br'], nome: 'Gilberto' },
};
router.post('/sso', async (req, res) => {
  try {
    const quem = sso.conferirPasse(req.body?.passe, 'agenda');
    if (!quem) return res.status(401).json({ erro: 'Passe inválido ou vencido' });
    const cfg = (process.env.SSO_USUARIOS ? JSON.parse(process.env.SSO_USUARIOS) : SSO_PADRAO)[quem.sub];
    let usuario = null;
    if (cfg?.emails?.length) {
      const { rows } = await query('SELECT * FROM usuarios WHERE email = ANY($1) AND ativo = true LIMIT 1', [cfg.emails.map((e) => e.toLowerCase())]);
      usuario = rows[0];
    }
    if (!usuario && cfg?.nome) {
      const { rows } = await query("SELECT * FROM usuarios WHERE nome ILIKE $1 AND ativo = true", [cfg.nome + '%']);
      if (rows.length === 1) usuario = rows[0];
    }
    if (!usuario) return res.status(403).json({ erro: 'Usuário não encontrado na Agenda' });
    res.json({
      token: gerarToken(usuario),
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    });
  } catch (err) {
    console.error('Erro no SSO:', err);
    res.status(500).json({ erro: 'Erro ao entrar' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe e-mail e senha' });
    }

    const { rows } = await query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
      [email.toLowerCase().trim()]
    );

    const usuario = rows[0];
    // Compara mesmo sem usuário para não revelar quais e-mails existem
    const confere = usuario
      ? await bcrypt.compare(senha, usuario.senha_hash)
      : await bcrypt.compare(senha, '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv');

    if (!usuario || !confere) {
      return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
    }

    res.json({
      token: gerarToken(usuario),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Erro ao entrar' });
  }
});

router.get('/eu', exigirLogin, (req, res) => {
  res.json(req.usuario);
});

router.post('/trocar-senha', exigirLogin, async (req, res) => {
  try {
    const { senha_atual, senha_nova } = req.body;

    if (!senha_nova || senha_nova.length < 8) {
      return res.status(400).json({ erro: 'A senha nova precisa ter pelo menos 8 caracteres' });
    }

    const { rows } = await query('SELECT * FROM usuarios WHERE id = $1', [req.usuario.id]);
    const usuario = rows[0];

    if (!usuario || !(await bcrypt.compare(senha_atual || '', usuario.senha_hash))) {
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    }

    const hash = await bcrypt.hash(senha_nova, 10);
    await query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [hash, req.usuario.id]);

    res.json({ mensagem: 'Senha alterada' });
  } catch (err) {
    console.error('Erro ao trocar senha:', err);
    res.status(500).json({ erro: 'Erro ao trocar senha' });
  }
});

export default router;
