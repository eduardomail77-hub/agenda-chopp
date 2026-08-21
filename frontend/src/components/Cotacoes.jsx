import { useState, useEffect } from 'react';
import {
  getCotacoes,
  atualizarCotacao,
  converterCotacao,
  getCervejas,
  getChopeiras,
  getUsuarios,
  getPreferencias,
} from '../services/api';

const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const soData = (s) => (s ? String(s).split('T')[0] : '');
const dataBR = (s) => {
  const d = soData(s);
  return d ? d.split('-').reverse().join('/') : null;
};
const hora = (h) => (h ? String(h).slice(0, 5) : null);

const TIPO_LABEL = {
  eletrica: 'Elétrica (tem 220V)',
  gelo: 'Gelo (sem energia)',
  indiferente: 'Sem preferência',
};

const STATUS_LABEL = {
  nova: 'Nova',
  respondida: 'Aguardando cliente',
  convertida: 'Virou pedido',
  perdida: 'Perdida',
};

/** Só dígitos, com 55 na frente, que é o formato que o wa.me aceita. */
function paraWhatsApp(telefone) {
  const digitos = String(telefone || '').replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.startsWith('55')) return digitos;
  return `55${digitos}`;
}

function montarMensagem(c, itens, entrega, desconto) {
  const subtotal = itens.reduce(
    (s, i) => s + (Number(i.litros) || 0) * (Number(i.valor_litro) || 0),
    0
  );
  const total = subtotal + (Number(entrega) || 0) - (Number(desconto) || 0);

  const linhas = [
    `Olá, ${c.cliente}! Aqui é da Cervejaria Fora da Lei.`,
    '',
    `Segue a cotação do seu evento:`,
    '',
  ];

  itens.forEach((i) => {
    const litros = Number(i.litros) || 0;
    const vl = Number(i.valor_litro) || 0;
    linhas.push(`• ${i.cerveja} — ${litros}L x ${brl(vl)} = ${brl(litros * vl)}`);
  });

  linhas.push('');
  if (Number(entrega) > 0) {
    linhas.push(`Entrega, instalação e chopeira: ${brl(entrega)}`);
  }
  if (Number(desconto) > 0) {
    linhas.push(`Desconto: -${brl(desconto)}`);
  }
  linhas.push(`*Total: ${brl(total)}*`);
  linhas.push('');

  if (c.data_entrega) {
    linhas.push(
      `Entrega: ${dataBR(c.data_entrega)}${hora(c.hora_entrega) ? ` às ${hora(c.hora_entrega)}` : ''}`
    );
  }
  if (c.data_coleta) {
    linhas.push(
      `Recolhimento: ${dataBR(c.data_coleta)}${hora(c.hora_coleta) ? ` às ${hora(c.hora_coleta)}` : ''}`
    );
  }
  if (c.endereco) linhas.push(`Endereço: ${c.endereco}`);

  linhas.push('');
  linhas.push(
    'Aguardo sua confirmação para reservar o chopp e a chopeira na sua data. Qualquer ajuste, é só falar!'
  );

  return linhas.join('\n');
}

export default function Cotacoes({ ehAdmin, onConvertida }) {
  const [cotacoes, setCotacoes] = useState([]);
  const [aberta, setAberta] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [filtro, setFiltro] = useState('nova');

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    try {
      setCarregando(true);
      setCotacoes(await getCotacoes());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  const visiveis = cotacoes.filter((c) => (filtro === 'todas' ? true : c.status === filtro));
  const novas = cotacoes.filter((c) => c.status === 'nova').length;

  if (carregando) {
    return (
      <main className="body">
        <div className="loading">Carregando cotações...</div>
      </main>
    );
  }

  return (
    <main className="body">
      {erro && <div className="error">{erro}</div>}

      <div className="subtabs">
        {[
          ['nova', `Novas${novas ? ` (${novas})` : ''}`],
          ['respondida', 'Aguardando cliente'],
          ['convertida', 'Viraram pedido'],
          ['perdida', 'Perdidas'],
          ['todas', 'Todas'],
        ].map(([k, l]) => (
          <button key={k} className={filtro === k ? 'subtab on' : 'subtab'} onClick={() => setFiltro(k)}>
            {l}
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="hint">Nenhuma cotação aqui.</p>
      ) : (
        <div className="grid">
          {visiveis.map((c) => (
            <CardCotacao
              key={c.id}
              cotacao={c}
              ehAdmin={ehAdmin}
              onAbrir={() => setAberta(c)}
            />
          ))}
        </div>
      )}

      {aberta && (
        <ResponderCotacao
          cotacao={aberta}
          ehAdmin={ehAdmin}
          onFechar={() => setAberta(null)}
          onAtualizada={async () => {
            await carregar();
            setAberta(null);
          }}
          onConvertida={async () => {
            await carregar();
            setAberta(null);
            onConvertida?.();
          }}
        />
      )}
    </main>
  );
}

function CardCotacao({ cotacao: c, onAbrir }) {
  return (
    <article className={`card ${c.status === 'nova' ? 'pendente' : ''}`}>
      <div className="cardTop">
        <div className="dateChip">
          <span className="dnum">{soData(c.data_entrega).split('-')[2] || '--'}</span>
          <span className="dinfo">
            {soData(c.data_entrega).split('-')[1] || '--'}/{soData(c.data_entrega).slice(2, 4)}
          </span>
        </div>
        <div className="cliente">
          <h3 style={{ margin: 0 }}>{c.cliente}</h3>
          <span className="tel">{c.telefone}</span>
          {c.endereco && <span className="endereco">{c.endereco}</span>}
        </div>
        <span className={`badge ${c.status === 'nova' ? 'pendente' : ''}`}>
          {STATUS_LABEL[c.status]}
        </span>
      </div>

      <div className="rows">
        <div className="row">
          <span className="rl">Cervejas</span>
          <span className="rv">
            {c.itens?.map((i) => `${i.cerveja}${i.litros ? ` (${Number(i.litros)}L)` : ''}`).join(', ') ||
              'não informado'}
          </span>
        </div>
        <div className="row">
          <span className="rl">Chopeira</span>
          <span className="rv">{TIPO_LABEL[c.tipo_chopeira] || 'Sem preferência'}</span>
        </div>
        {c.pessoas && (
          <div className="row">
            <span className="rl">Pessoas</span>
            <span className="rv">{c.pessoas}</span>
          </div>
        )}
        {c.observacoes && (
          <div className="row">
            <span className="rl">Obs.</span>
            <span className="rv">{c.observacoes}</span>
          </div>
        )}
      </div>

      <div className="cardBottom">
        <div className="total">
          <span>Recebida</span>
          <b style={{ fontSize: '13px' }}>
            {new Date(c.created_at).toLocaleDateString('pt-BR')}
          </b>
        </div>
        <div className="actions">
          <button className="confirm" onClick={onAbrir}>
            {c.status === 'nova' ? 'Responder' : 'Abrir'}
          </button>
        </div>
      </div>
    </article>
  );
}

function ResponderCotacao({ cotacao, ehAdmin, onFechar, onAtualizada, onConvertida }) {
  const [itens, setItens] = useState(
    cotacao.itens?.length ? cotacao.itens.map((i) => ({ ...i })) : []
  );
  const [entrega, setEntrega] = useState(cotacao.valor_entrega_coleta ?? '');
  const [desconto, setDesconto] = useState(cotacao.desconto ?? '');
  const [cervejas, setCervejas] = useState([]);
  const [chopeiras, setChopeiras] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [escolhidas, setEscolhidas] = useState([]);
  const [respEntrega, setRespEntrega] = useState('');
  const [respColeta, setRespColeta] = useState('');
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';

    Promise.all([getCervejas(), getChopeiras(), getUsuarios(), getPreferencias()])
      .then(([cerv, chop, pessoas, prefs]) => {
        setCervejas(cerv.filter((c) => c.ativo));
        setChopeiras(chop.filter((c) => c.ativo));
        setEquipe(pessoas.filter((p) => p.ativo));

        // Preço de tabela entra sozinho onde o cliente não informou valor
        setItens((atual) =>
          atual.map((i) => ({
            ...i,
            valor_litro: i.valor_litro ?? cerv.find((c) => c.nome === i.cerveja)?.preco_litro ?? '',
          }))
        );
        if (cotacao.valor_entrega_coleta == null) {
          setEntrega(prefs.valor_entrega_padrao || '');
        }
      })
      .catch((e) => setErro(e.message));

    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [onFechar]);

  const setItem = (i, k, v) =>
    setItens((atual) => atual.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  const subtotal = itens.reduce(
    (s, i) => s + (Number(i.litros) || 0) * (Number(i.valor_litro) || 0),
    0
  );
  const total = subtotal + (Number(entrega) || 0) - (Number(desconto) || 0);

  const precificada = itens.length > 0 && itens.every((i) => Number(i.litros) > 0 && Number(i.valor_litro) > 0);
  const zap = paraWhatsApp(cotacao.telefone);

  async function salvar(novoStatus) {
    setSalvando(true);
    setErro(null);
    setOk(null);
    try {
      await atualizarCotacao(cotacao.id, {
        itens: itens.map((i) => ({
          cerveja: i.cerveja,
          litros: i.litros || null,
          valor_litro: i.valor_litro || null,
        })),
        valor_entrega_coleta: entrega === '' ? null : entrega,
        desconto: desconto === '' ? 0 : desconto,
        ...(novoStatus ? { status: novoStatus } : {}),
      });
      return true;
    } catch (e) {
      setErro(e.message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  /** Salva, marca como respondida e abre o WhatsApp com a mensagem pronta. */
  async function enviarPeloWhatsApp() {
    if (!zap) {
      setErro('Telefone do cliente não está num formato que o WhatsApp aceite');
      return;
    }
    if (!(await salvar('respondida'))) return;

    const texto = montarMensagem(cotacao, itens, entrega, desconto);
    window.open(`https://wa.me/${zap}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    onAtualizada();
  }

  async function converter() {
    if (!escolhidas.length) {
      setErro('Escolha as chopeiras antes de gerar o pedido');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      await salvar();
      await converterCotacao(cotacao.id, {
        chopeiras: escolhidas,
        resp_entrega: respEntrega || null,
        resp_coleta: respColeta || null,
      });
      onConvertida();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const toggleChop = (id) =>
    setEscolhidas((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <div className="modalFundo" onClick={onFechar}>
      <div className="modalCaixa" onClick={(e) => e.stopPropagation()}>
        <div className="modalTopo">
          <div>
            <h2>Cotação #{cotacao.id}</h2>
            <p className="hint" style={{ margin: 0 }}>
              {cotacao.cliente} · {cotacao.telefone}
            </p>
          </div>
          <button className="modalFechar" onClick={onFechar} title="Fechar">✕</button>
        </div>

        <div className="form">
          {erro && <div className="error">{erro}</div>}
          {ok && <div className="ok">{ok}</div>}

          <div className="resumoPedido">
            {cotacao.endereco && <p><strong>Endereço:</strong> {cotacao.endereco}</p>}
            <p>
              <strong>Entrega:</strong> {dataBR(cotacao.data_entrega) || 'a definir'}
              {hora(cotacao.hora_entrega) ? ` às ${hora(cotacao.hora_entrega)}` : ''}
              {' · '}
              <strong>Recolhimento:</strong> {dataBR(cotacao.data_coleta) || 'a combinar'}
              {hora(cotacao.hora_coleta) ? ` às ${hora(cotacao.hora_coleta)}` : ''}
            </p>
            <p><strong>Chopeira pedida:</strong> {TIPO_LABEL[cotacao.tipo_chopeira]}</p>
            {cotacao.pessoas && <p><strong>Pessoas:</strong> {cotacao.pessoas}</p>}
            {cotacao.observacoes && <p><strong>Observações:</strong> {cotacao.observacoes}</p>}
          </div>

          <div className="fblock">
            <label className="lbl">Preencha os valores</label>
            <div className="itemHead">
              <span>Rótulo</span>
              <span>Litros</span>
              <span>R$/litro</span>
              <span></span>
            </div>
            {itens.map((it, i) => (
              <div className="itemRow" key={i}>
                <select value={it.cerveja} onChange={(e) => setItem(i, 'cerveja', e.target.value)}>
                  {cervejas.map((c) => (
                    <option key={c.nome} value={c.nome}>{c.nome} — {c.estilo}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={it.litros ?? ''}
                  onChange={(e) => setItem(i, 'litros', e.target.value)}
                  placeholder="0"
                />
                <input
                  type="number"
                  step="0.01"
                  value={it.valor_litro ?? ''}
                  onChange={(e) => setItem(i, 'valor_litro', e.target.value)}
                  placeholder="0,00"
                />
                <button
                  type="button"
                  className="rmItem"
                  onClick={() => setItens((a) => a.filter((_, idx) => idx !== i))}
                  disabled={itens.length === 1}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="addItem"
              onClick={() =>
                setItens((a) => [
                  ...a,
                  { cerveja: cervejas[0]?.nome || '', litros: '', valor_litro: cervejas[0]?.preco_litro || '' },
                ])
              }
            >
              + Adicionar cerveja
            </button>
          </div>

          <div className="fgrid">
            <label className="field">
              <span>Entrega, instalação e chopeira (R$)</span>
              <input type="number" step="0.01" min="0" value={entrega}
                onChange={(e) => setEntrega(e.target.value)} placeholder="0,00" />
            </label>
            <label className="field">
              <span>Desconto (R$)</span>
              <input type="number" step="0.01" min="0" value={desconto}
                onChange={(e) => setDesconto(e.target.value)} placeholder="0,00" />
            </label>
          </div>

          <div className="resumo">
            <div className="resumoLinha"><span>Chopp</span><b>{brl(subtotal)}</b></div>
            <div className="resumoLinha"><span>Entrega, instalação e chopeira</span><b>{brl(entrega)}</b></div>
            {Number(desconto) > 0 && (
              <div className="resumoLinha desconto"><span>Desconto</span><b>- {brl(desconto)}</b></div>
            )}
            <div className="resumoLinha totalLinha"><span>Total</span><b>{brl(total)}</b></div>
          </div>

          <div className="formFoot">
            {cotacao.status !== 'convertida' && (
              <button
                type="button"
                className="btn-sair"
                disabled={salvando}
                onClick={async () => {
                  if (!confirm('Marcar esta cotação como perdida? Ela sai da lista de novas.')) return;
                  if (await salvar('perdida')) onAtualizada();
                }}
              >
                Marcar como perdida
              </button>
            )}
            <button type="button" className="btn-sair" onClick={() => salvar().then((r) => r && setOk('Rascunho salvo'))} disabled={salvando}>
              Salvar rascunho
            </button>
            <button
              type="button"
              className="save"
              onClick={enviarPeloWhatsApp}
              disabled={!precificada || salvando}
              title={precificada ? '' : 'Preencha litros e valor por litro de cada cerveja'}
            >
              {salvando ? 'Salvando...' : 'Enviar cotação pelo WhatsApp'}
            </button>
          </div>

          {ehAdmin && cotacao.status !== 'convertida' && (
            <div className="fblock" style={{ marginTop: '8px' }}>
              <label className="lbl">Cliente aceitou? Gere o pedido</label>
              <p className="hint">
                Escolha as chopeiras e o pedido nasce pendente na agenda. Confirmar continua
                sendo um passo separado, é ele que ocupa a frota e dispara os avisos.
              </p>
              <div className="pickGrid">
                {chopeiras.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`pick ${escolhidas.includes(c.id) ? 'on' : ''} ${c.tipo === 'Gelo' ? 'gelo' : ''}`}
                    onClick={() => toggleChop(c.id)}
                  >
                    <div className="pickHead">
                      <b>{c.id}</b>
                      <span className={`viasBadge v${c.vias}`}>{c.vias} via{c.vias > 1 ? 's' : ''}</span>
                    </div>
                    <span className="pickSub">
                      {c.tipo}{c.vazao ? ` · ${c.vazao} L/h` : ''}
                    </span>
                  </button>
                ))}
              </div>
              <div className="fgrid">
                <label className="field">
                  <span>Responsável pela entrega</span>
                  <select value={respEntrega} onChange={(e) => setRespEntrega(e.target.value)}>
                    <option value="">Definir depois</option>
                    {equipe.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Responsável pelo recolhimento</span>
                  <select value={respColeta} onChange={(e) => setRespColeta(e.target.value)}>
                    <option value="">Definir depois</option>
                    {equipe.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={converter}
                disabled={!precificada || salvando}
              >
                Gerar pedido a partir desta cotação
              </button>
            </div>
          )}

          {cotacao.status === 'convertida' && (
            <div className="ok">Essa cotação já virou o pedido #{cotacao.pedido_id}.</div>
          )}
        </div>
      </div>
    </div>
  );
}
