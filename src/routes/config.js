import express from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db/connection.js';
import { exigirLogin, exigirAdmin } from '../middleware/auth.js';
import {
  compartilharCalendario,
  removerAcessoCalendario,
  testarConexao,
} from '../services/googleCalendarService.js';

const router = express.Router();

// Tudo aqui exige estar logado; escrita exige admin
router.use(exigirLogin);

/* ---------- Diagnóstico da integração com o Google ---------- */

router.get('/google/status', async (req, res) => {
  res.json(await testarConexao());
});

/* ---------- Equipe ---------- */

router.get('/usuarios', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT id, nome, email, telefone, perfil, recebe_aviso, ativo FROM usuarios ORDER BY nome ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error('Erro ao listar usuários:', err);
    res.status(500).json({ erro: 'Erro ao listar usuários' });
  }
});

router.post('/usuarios', exigirAdmin, async (req, res) => {
  try {
    const { nome, email, telefone, senha, perfil = 'vendedor', recebe_aviso = true } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios' });
    }
    if (senha.length < 8) {
      return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres' });
    }
    if (!['admin', 'vendedor'].includes(perfil)) {
      return res.status(400).json({ erro: 'Perfil inválido' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (nome, email, telefone, senha_hash, perfil, recebe_aviso)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nome, email, telefone, perfil, recebe_aviso, ativo`,
      [nome, email.toLowerCase().trim(), telefone || null, hash, perfil, recebe_aviso]
    );

    if (recebe_aviso) {
      await compartilharCalendario(email.toLowerCase().trim());
    }

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe alguém com esse e-mail' });
    }
    console.error('Erro ao criar usuário:', err);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

router.put('/usuarios/:id', exigirAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, telefone, perfil, recebe_aviso, ativo, senha } = req.body;

    const atual = await query('SELECT * FROM usuarios WHERE id = $1', [id]);
    if (atual.rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }
    const antes = atual.rows[0];

    if (perfil && !['admin', 'vendedor'].includes(perfil)) {
      return res.status(400).json({ erro: 'Perfil inválido' });
    }

    // Não deixa remover o último admin ativo
    const viraNaoAdmin = (perfil && perfil !== 'admin') || ativo === false;
    if (antes.perfil === 'admin' && viraNaoAdmin) {
      const { rows } = await query(
        "SELECT COUNT(*)::int AS n FROM usuarios WHERE perfil = 'admin' AND ativo = true AND id <> $1",
        [id]
      );
      if (rows[0].n === 0) {
        return res.status(400).json({ erro: 'Precisa existir pelo menos um administrador ativo' });
      }
    }

    let hash = null;
    if (senha) {
      if (senha.length < 8) {
        return res.status(400).json({ erro: 'A senha precisa ter pelo menos 8 caracteres' });
      }
      hash = await bcrypt.hash(senha, 10);
    }

    const { rows } = await query(
      `UPDATE usuarios SET
         nome = COALESCE($1, nome),
         telefone = COALESCE($2, telefone),
         perfil = COALESCE($3, perfil),
         recebe_aviso = COALESCE($4, recebe_aviso),
         ativo = COALESCE($5, ativo),
         senha_hash = COALESCE($6, senha_hash)
       WHERE id = $7
       RETURNING id, nome, email, telefone, perfil, recebe_aviso, ativo`,
      [nome ?? null, telefone ?? null, perfil ?? null, recebe_aviso ?? null, ativo ?? null, hash, id]
    );

    const depois = rows[0];
    if (depois.recebe_aviso && depois.ativo) {
      await compartilharCalendario(depois.email);
    } else if (antes.recebe_aviso) {
      await removerAcessoCalendario(depois.email);
    }

    res.json(depois);
  } catch (err) {
    console.error('Erro ao atualizar usuário:', err);
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

/* ---------- Preferências (lembretes, valores padrão) ---------- */

router.get('/preferencias', async (req, res) => {
  try {
    const { rows } = await query('SELECT chave, valor FROM configuracoes');
    const config = Object.fromEntries(rows.map((r) => [r.chave, r.valor]));
    res.json(config);
  } catch (err) {
    console.error('Erro ao buscar preferências:', err);
    res.status(500).json({ erro: 'Erro ao buscar preferências' });
  }
});

const CHAVES_VALIDAS = [
  'lembretes',
  'valor_entrega_padrao',
  'hora_entrega_padrao',
  'hora_coleta_padrao',
];

router.put('/preferencias', exigirAdmin, async (req, res) => {
  try {
    const entradas = Object.entries(req.body).filter(([k]) => CHAVES_VALIDAS.includes(k));

    if (entradas.length === 0) {
      return res.status(400).json({ erro: 'Nenhuma configuração válida enviada' });
    }

    for (const [chave, valor] of entradas) {
      if (chave === 'lembretes') {
        const minutos = String(valor)
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean);
        const invalido = minutos.some((m) => !/^\d+$/.test(m) || Number(m) > 40320);
        if (invalido) {
          return res.status(400).json({ erro: 'Lembretes inválidos (use minutos, no máximo 4 semanas)' });
        }
      }

      await query(
        `INSERT INTO configuracoes (chave, valor, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (chave) DO UPDATE SET valor = $2, updated_at = CURRENT_TIMESTAMP`,
        [chave, String(valor)]
      );
    }

    const { rows } = await query('SELECT chave, valor FROM configuracoes');
    res.json(Object.fromEntries(rows.map((r) => [r.chave, r.valor])));
  } catch (err) {
    console.error('Erro ao salvar preferências:', err);
    res.status(500).json({ erro: 'Erro ao salvar preferências' });
  }
});

/* ---------- Catálogo: cervejas ---------- */

router.post('/cervejas', exigirAdmin, async (req, res) => {
  try {
    const { nome, estilo, abv, ibu, preco_litro = 0 } = req.body;
    if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

    const { rows } = await query(
      'INSERT INTO cervejas (nome, estilo, abv, ibu, preco_litro) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [nome, estilo || null, abv || null, ibu || null, preco_litro]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma cerveja com esse nome' });
    }
    console.error('Erro ao criar cerveja:', err);
    res.status(500).json({ erro: 'Erro ao criar cerveja' });
  }
});

router.put('/cervejas/:id', exigirAdmin, async (req, res) => {
  try {
    const { nome, estilo, abv, ibu, preco_litro, ativo } = req.body;
    const { rows } = await query(
      `UPDATE cervejas SET
         nome = COALESCE($1, nome),
         estilo = COALESCE($2, estilo),
         abv = COALESCE($3, abv),
         ibu = COALESCE($4, ibu),
         preco_litro = COALESCE($5, preco_litro),
         ativo = COALESCE($6, ativo)
       WHERE id = $7 RETURNING *`,
      [nome ?? null, estilo ?? null, abv ?? null, ibu ?? null, preco_litro ?? null, ativo ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Cerveja não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar cerveja:', err);
    res.status(500).json({ erro: 'Erro ao atualizar cerveja' });
  }
});

/* ---------- Catálogo: chopeiras ---------- */

router.post('/chopeiras', exigirAdmin, async (req, res) => {
  try {
    const { id, tipo, vias, vazao } = req.body;
    if (!id || !tipo || !vias) {
      return res.status(400).json({ erro: 'Id, tipo e vias são obrigatórios' });
    }
    if (!['Elétrica', 'Gelo'].includes(tipo)) {
      return res.status(400).json({ erro: 'Tipo deve ser Elétrica ou Gelo' });
    }

    const { rows } = await query(
      'INSERT INTO chopeiras (id, tipo, vias, vazao) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, tipo, vias, vazao || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ erro: 'Já existe uma chopeira com esse código' });
    }
    console.error('Erro ao criar chopeira:', err);
    res.status(500).json({ erro: 'Erro ao criar chopeira' });
  }
});

router.put('/chopeiras/:id', exigirAdmin, async (req, res) => {
  try {
    const { tipo, vias, vazao, ativo } = req.body;
    const { rows } = await query(
      `UPDATE chopeiras SET
         tipo = COALESCE($1, tipo),
         vias = COALESCE($2, vias),
         vazao = COALESCE($3, vazao),
         ativo = COALESCE($4, ativo)
       WHERE id = $5 RETURNING *`,
      [tipo ?? null, vias ?? null, vazao ?? null, ativo ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ erro: 'Chopeira não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Erro ao atualizar chopeira:', err);
    res.status(500).json({ erro: 'Erro ao atualizar chopeira' });
  }
});

export default router;
