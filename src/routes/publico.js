import express from 'express';
import { query, transacao } from '../db/connection.js';
import { avisarCotacaoNova } from '../services/googleCalendarService.js';
import { avisarCotacaoPorWhatsApp } from '../services/whatsappService.js';

const router = express.Router();

/**
 * Rotas abertas na internet, usadas pelo link de cotação que vai para o cliente.
 * Nada aqui devolve preço, valor de pedido ou qualquer dado da operação.
 */

/** Freio simples de abuso por IP: o formulário é público e sem captcha. */
const janelas = new Map();
const LIMITE = 5;
const JANELA_MS = 10 * 60 * 1000;

function limitarEnvios(req, res, next) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || 'desconhecido';
  const agora = Date.now();
  const registros = (janelas.get(ip) || []).filter((t) => agora - t < JANELA_MS);

  if (registros.length >= LIMITE) {
    return res.status(429).json({
      erro: 'Muitos pedidos de cotação seguidos. Tente de novo daqui a pouco ou fale com a gente no WhatsApp.',
    });
  }

  registros.push(agora);
  janelas.set(ip, registros);

  // Não deixa o mapa crescer para sempre
  if (janelas.size > 5000) {
    for (const [chave, tempos] of janelas) {
      if (tempos.every((t) => agora - t >= JANELA_MS)) janelas.delete(chave);
    }
  }

  next();
}

/** Catálogo para o cliente escolher, deliberadamente sem preço. */
router.get('/catalogo', async (req, res) => {
  try {
    const { rows } = await query(
      'SELECT nome, estilo, abv, ibu FROM cervejas WHERE ativo = true ORDER BY ordem ASC, nome ASC'
    );
    res.json({ cervejas: rows });
  } catch (err) {
    console.error('Erro ao buscar catálogo público:', err.message);
    res.status(500).json({ erro: 'Erro ao carregar o catálogo' });
  }
});

const TIPOS_CHOPEIRA = ['eletrica', 'gelo', 'indiferente'];
const BARRIL = 30;
const LIMITES = { cliente: 120, telefone: 30, endereco: 300, observacoes: 500, cerveja: 120 };

router.post('/cotacoes', limitarEnvios, async (req, res) => {
  try {
    const {
      cliente,
      telefone,
      endereco,
      data_entrega,
      hora_entrega,
      data_coleta,
      hora_coleta,
      tipo_chopeira,
      pessoas,
      observacoes,
      itens,
    } = req.body;

    if (!cliente?.trim() || !telefone?.trim()) {
      return res.status(400).json({ erro: 'Precisamos do seu nome e telefone' });
    }
    if (!data_entrega) {
      return res.status(400).json({ erro: 'Escolha a data da entrega' });
    }
    if (!itens?.length || !itens.some((i) => i.cerveja)) {
      return res.status(400).json({ erro: 'Escolha pelo menos uma cerveja' });
    }

    const hoje = new Date().toISOString().split('T')[0];
    if (data_entrega < hoje) {
      return res.status(400).json({ erro: 'A data da entrega não pode ser no passado' });
    }
    if (data_coleta && data_coleta < data_entrega) {
      return res.status(400).json({ erro: 'O recolhimento não pode ser antes da entrega' });
    }
    if (tipo_chopeira && !TIPOS_CHOPEIRA.includes(tipo_chopeira)) {
      return res.status(400).json({ erro: 'Tipo de chopeira inválido' });
    }

    const corta = (v, campo) => (v ? String(v).trim().slice(0, LIMITES[campo]) : null);

    // Só aceita rótulo que existe no catálogo, o corpo da requisição é público
    const catalogo = await query('SELECT nome FROM cervejas WHERE ativo = true');
    const validos = new Set(catalogo.rows.map((c) => c.nome));
    const itensLimpos = itens
      .filter((i) => validos.has(i.cerveja))
      .slice(0, 10)
      .map((i) => ({
        cerveja: corta(i.cerveja, 'cerveja'),
        litros: Number(i.litros) > 0 ? Math.min(Number(i.litros), 5000) : null,
      }));

    if (itensLimpos.length === 0) {
      return res.status(400).json({ erro: 'Escolha pelo menos uma cerveja do catálogo' });
    }

    // O chopp sai em barris de 30 litros
    const foraDoBarril = itensLimpos.find(
      (i) => !i.litros || i.litros < BARRIL || i.litros % BARRIL !== 0
    );
    if (foraDoBarril) {
      return res.status(400).json({
        erro: `A quantidade de cada cerveja precisa ser múltipla de ${BARRIL} litros, com mínimo de ${BARRIL}.`,
      });
    }

    const cotacao = await transacao(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO cotacoes
           (cliente, telefone, endereco, data_entrega, hora_entrega, data_coleta,
            hora_coleta, tipo_chopeira, pessoas, observacoes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          corta(cliente, 'cliente'),
          corta(telefone, 'telefone'),
          corta(endereco, 'endereco'),
          data_entrega,
          hora_entrega || null,
          data_coleta || null,
          hora_coleta || null,
          tipo_chopeira || 'indiferente',
          Number(pessoas) > 0 ? Math.min(Number(pessoas), 100000) : null,
          corta(observacoes, 'observacoes'),
        ]
      );

      const nova = rows[0];
      for (const item of itensLimpos) {
        await client.query(
          'INSERT INTO cotacao_itens (cotacao_id, cerveja, litros) VALUES ($1,$2,$3)',
          [nova.id, item.cerveja, item.litros]
        );
      }
      return nova;
    });

    // Nenhum aviso pode derrubar o envio do cliente, por isso não têm await.
    // São dois caminhos de propósito: o WhatsApp chega na hora, e o evento na
    // agenda fica como registro e rede de apoio se o WhatsApp falhar.
    const comItens = { ...cotacao, itens: itensLimpos };

    avisarCotacaoPorWhatsApp(comItens).catch((err) =>
      console.error('Falhou o aviso de cotação por WhatsApp:', err.message)
    );
    avisarCotacaoNova(comItens).catch((err) =>
      console.error('Falhou o aviso de cotação na agenda:', err.message)
    );

    res.status(201).json({
      ok: true,
      protocolo: cotacao.id,
      mensagem: 'Recebemos seu pedido de cotação, em breve retornamos pelo WhatsApp.',
    });
  } catch (err) {
    console.error('Erro ao registrar cotação:', err.message);
    res.status(500).json({ erro: 'Não consegui registrar sua cotação, tente de novo' });
  }
});

export default router;
