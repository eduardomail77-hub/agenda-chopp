import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { gerarToken, exigirLogin } from '../middleware/auth.js';

const router = express.Router();

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
