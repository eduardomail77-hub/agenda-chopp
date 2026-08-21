import { useState, useEffect } from 'react';
import {
  createPedido,
  getChopeiras,
  getCervejas,
  getUsuarios,
  getPreferencias,
} from '../services/api';
import Field from './common/Field';

const viasTxt = (v) => `${v} via${v > 1 ? 's' : ''}`;

const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcSubtotal = (f) =>
  (f.itens || []).reduce((s, it) => s + (Number(it.litros) || 0) * (Number(it.valor_litro) || 0), 0);

const calcTotal = (f) =>
  calcSubtotal(f) + (Number(f.valor_entrega_coleta) || 0) - (Number(f.desconto) || 0);

export default function NovoPedido({ orders = [], onSave }) {
  const [f, setF] = useState({
    cliente: '',
    telefone: '',
    endereco: '',
    data_entrega: '',
    hora_entrega: '',
    data_coleta: '',
    hora_coleta: '',
    itens: [{ cerveja: '', litros: '', valor_litro: '' }],
    chopeiras: [],
    gas: false,
    valor_entrega_coleta: '',
    desconto: '',
    pago: false,
    resp_entrega: '',
    resp_coleta: '',
  });

  const [chopeiras, setChopeiras] = useState([]);
  const [cervejas, setCervejas] = useState([]);
  const [equipe, setEquipe] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [chop, cerv, pessoas, prefs] = await Promise.all([
        getChopeiras(),
        getCervejas(),
        getUsuarios(),
        getPreferencias(),
      ]);
      const ativas = cerv.filter((c) => c.ativo);
      setChopeiras(chop.filter((c) => c.ativo));
      setCervejas(ativas);
      setEquipe(pessoas.filter((p) => p.ativo));

      // Já entra com o rótulo e os valores padrão preenchidos, mas tudo editável
      setF((p) => ({
        ...p,
        valor_entrega_coleta: prefs.valor_entrega_padrao || '',
        hora_entrega: prefs.hora_entrega_padrao || '10:00',
        hora_coleta: prefs.hora_coleta_padrao || '10:00',
        itens: [
          {
            cerveja: ativas[0]?.nome || '',
            litros: '',
            valor_litro: ativas[0]?.preco_litro || '',
          },
        ],
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const precoDe = (nome) => cervejas.find((c) => c.nome === nome)?.preco_litro ?? '';

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const setItem = (i, k, v) =>
    setF((p) => ({
      ...p,
      itens: p.itens.map((it, idx) => {
        if (idx !== i) return it;
        // Trocar o rótulo repõe o preço de tabela, o vendedor ainda pode ajustar
        if (k === 'cerveja') return { ...it, cerveja: v, valor_litro: precoDe(v) };
        return { ...it, [k]: v };
      }),
    }));

  const addItem = () =>
    setF((p) => ({
      ...p,
      itens: [
        ...p.itens,
        { cerveja: cervejas[0]?.nome || '', litros: '', valor_litro: cervejas[0]?.preco_litro || '' },
      ],
    }));

  const rmItem = (i) => setF((p) => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }));

  const ocup = new Set();
  if (f.data_entrega) {
    orders.forEach((o) => {
      const dataPedido = String(o.data_entrega).split('T')[0];
      if (dataPedido === f.data_entrega && o.status === 'confirmado') {
        o.chopeiras?.forEach((c) => ocup.add(c));
      }
    });
  }

  const toggleChop = (id) =>
    set('chopeiras', f.chopeiras.includes(id) ? f.chopeiras.filter((x) => x !== id) : [...f.chopeiras, id]);

  const viasSel = chopeiras
    .filter((c) => f.chopeiras.includes(c.id))
    .reduce((s, c) => s + c.vias, 0);
  const numCervejas = f.itens.length;

  const subtotal = calcSubtotal(f);
  const total = calcTotal(f);
  const valido =
    f.cliente &&
    f.data_entrega &&
    f.chopeiras.length > 0 &&
    f.itens.some((it) => it.cerveja && it.litros);

  async function handleSave() {
    if (!valido) return;

    try {
      setSaving(true);
      setError(null);
      await createPedido({
        cliente: f.cliente,
        telefone: f.telefone,
        endereco: f.endereco,
        data_entrega: f.data_entrega,
        hora_entrega: f.hora_entrega || null,
        data_coleta: f.data_coleta || null,
        hora_coleta: f.hora_coleta || null,
        gas: f.gas,
        valor_entrega_coleta: f.valor_entrega_coleta || 0,
        desconto: f.desconto || 0,
        pago: f.pago,
        resp_entrega: f.resp_entrega || null,
        resp_coleta: f.resp_coleta || null,
        itens: f.itens.filter((it) => it.cerveja && it.litros),
        chopeiras: f.chopeiras,
      });
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="body">
        <div className="loading">Carregando recursos...</div>
      </main>
    );
  }

  return (
    <main className="body">
      {error && <div className="error">{error}</div>}
      <div className="form">
        <div className="fgrid">
          <Field label="Nome do cliente" span2>
            <input
              value={f.cliente}
              onChange={(e) => set('cliente', e.target.value)}
              placeholder="Ex.: Casamento da Ana"
            />
          </Field>
          <Field label="WhatsApp / telefone">
            <input
              value={f.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(51) 9..."
            />
          </Field>
          <Field label="Endereço do evento" span2>
            <input
              value={f.endereco}
              onChange={(e) => set('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade"
            />
          </Field>
        </div>

        <div className="fblock">
          <label className="lbl">Entrega</label>
          <div className="fgrid">
            <Field label="Data">
              <input
                type="date"
                value={f.data_entrega}
                onChange={(e) => {
                  set('data_entrega', e.target.value);
                  // Recolhimento não pode ficar para trás da entrega
                  if (f.data_coleta && f.data_coleta < e.target.value) {
                    set('data_coleta', e.target.value);
                  }
                }}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={f.hora_entrega}
                onChange={(e) => set('hora_entrega', e.target.value)}
              />
            </Field>
            <Field label="Responsável">
              <select value={f.resp_entrega} onChange={(e) => set('resp_entrega', e.target.value)}>
                <option value="">Definir depois</option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="fblock">
          <label className="lbl">Recolhimento</label>
          <div className="fgrid">
            <Field label="Data">
              <input
                type="date"
                value={f.data_coleta}
                min={f.data_entrega || undefined}
                onChange={(e) => set('data_coleta', e.target.value)}
              />
            </Field>
            <Field label="Hora">
              <input
                type="time"
                value={f.hora_coleta}
                onChange={(e) => set('hora_coleta', e.target.value)}
              />
            </Field>
            <Field label="Responsável">
              <select value={f.resp_coleta} onChange={(e) => set('resp_coleta', e.target.value)}>
                <option value="">Definir depois</option>
                {equipe.map((p) => (
                  <option key={p.id} value={p.nome}>{p.nome}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="fblock">
          <label className="lbl">Cervejas do pedido</label>
          <div className="itemHead">
            <span>Rótulo</span>
            <span>Litros</span>
            <span>R$/litro</span>
            <span></span>
          </div>
          {f.itens.map((it, i) => (
            <div className="itemRow" key={i}>
              <select
                value={it.cerveja}
                onChange={(e) => setItem(i, 'cerveja', e.target.value)}
              >
                {cervejas.map((c) => (
                  <option key={c.nome} value={c.nome}>
                    {c.nome} — {c.estilo}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="0"
                value={it.litros}
                onChange={(e) => setItem(i, 'litros', e.target.value)}
              />
              <input
                type="number"
                placeholder="0,00"
                value={it.valor_litro}
                onChange={(e) => setItem(i, 'valor_litro', e.target.value)}
              />
              <button
                className="rmItem"
                onClick={() => rmItem(i)}
                disabled={f.itens.length === 1}
                title="Remover"
              >
                ✕
              </button>
            </div>
          ))}
          <button className="addItem" onClick={addItem}>
            + Adicionar cerveja
          </button>
        </div>

        <div className="fblock">
          <label className="lbl">Chopeiras {f.data_entrega ? '' : '(escolha a data primeiro)'}</label>
          <div className="pickGrid">
            {chopeiras.map((c) => {
              const busy = ocup.has(c.id);
              const on = f.chopeiras.includes(c.id);
              return (
                <button
                  key={c.id}
                  disabled={busy || !f.data_entrega}
                  className={`pick ${on ? 'on' : ''} ${busy ? 'busy' : ''} ${
                    c.tipo === 'Gelo' ? 'gelo' : ''
                  }`}
                  onClick={() => toggleChop(c.id)}
                  title={`${c.id} · ${c.tipo}`}
                  type="button"
                >
                  <div className="pickHead">
                    <b>{c.id}</b>
                    <span className={`viasBadge v${c.vias}`}>{viasTxt(c.vias)}</span>
                  </div>
                  <span className="pickSub">
                    {c.tipo}
                    {c.vazao ? ` · ${c.vazao} L/h` : ''}
                  </span>
                  {busy && <em>ocupada</em>}
                </button>
              );
            })}
          </div>
          {f.chopeiras.length > 0 && (
            <div className={`capMsg ${viasSel >= numCervejas ? 'ok' : 'warn'}`}>
              {viasSel} {viasSel === 1 ? 'via' : 'vias'} · {numCervejas}{' '}
              {numCervejas === 1 ? 'cerveja' : 'cervejas'}
              {viasSel >= numCervejas
                ? '  — capacidade ok'
                : '  — faltam vias pra puxar todos os rótulos ao mesmo tempo'}
            </div>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={f.gas}
              onChange={(e) => set('gas', e.target.checked)}
            />
            Inclui gás
          </label>
        </div>

        <div className="fblock">
          <label className="lbl">Fechamento</label>
          <div className="fgrid">
            <Field label="Entrega, instalação e chopeira (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={f.valor_entrega_coleta}
                onChange={(e) => set('valor_entrega_coleta', e.target.value)}
                placeholder="0,00"
              />
            </Field>
            <Field label="Desconto (R$)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={f.desconto}
                onChange={(e) => set('desconto', e.target.value)}
                placeholder="0,00"
              />
            </Field>
          </div>

          <div className="resumo">
            <div className="resumoLinha">
              <span>Chopp</span>
              <b>{brl(subtotal)}</b>
            </div>
            <div className="resumoLinha">
              <span>Entrega, instalação e chopeira</span>
              <b>{brl(f.valor_entrega_coleta)}</b>
            </div>
            {Number(f.desconto) > 0 && (
              <div className="resumoLinha desconto">
                <span>Desconto</span>
                <b>- {brl(f.desconto)}</b>
              </div>
            )}
          </div>
        </div>

        <div className="formFoot">
          <label className="check big">
            <input
              type="checkbox"
              checked={f.pago}
              onChange={(e) => set('pago', e.target.checked)}
            />
            Já está pago
          </label>
          <div className="totalBox">
            <span>Total do pedido</span>
            <b>{brl(total)}</b>
          </div>
          <button className="save" disabled={!valido || saving} onClick={handleSave}>
            {saving ? 'Salvando...' : 'Salvar como pendente'}
          </button>
        </div>
      </div>
    </main>
  );
}
