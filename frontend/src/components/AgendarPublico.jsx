import { useState, useEffect } from 'react';
import { getChopeiras, getCervejas } from '../services/api';
import Field from './common/Field';

const EQUIPE = ['Eduardo', 'Giba', 'Entregador 1', 'Entregador 2'];
const viasTxt = (v) => `${v} via${v > 1 ? 's' : ''}`;

const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcTotal = (f) =>
  (f.itens || []).reduce((s, it) => s + (Number(it.litros) || 0) * (Number(it.valor_litro) || 0), 0) +
  (Number(f.valor_entrega_coleta) || 0);

export default function AgendarPublico() {
  const [f, setF] = useState({
    cliente: '',
    telefone: '',
    data_entrega: '',
    itens: [{ cerveja: 'Predileta', litros: '', valor_litro: '' }],
    chopeiras: [],
    gas: false,
    valor_entrega_coleta: '',
  });

  const [chopeiras, setChopeiras] = useState([]);
  const [cervejas, setCervejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [chop, cerv] = await Promise.all([getChopeiras(), getCervejas()]);
      setChopeiras(chop);
      setCervejas(cerv);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const setItem = (i, k, v) =>
    setF((p) => ({ ...p, itens: p.itens.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));
  const addItem = () =>
    setF((p) => ({ ...p, itens: [...p.itens, { cerveja: 'Predileta', litros: '', valor_litro: '' }] }));
  const rmItem = (i) => setF((p) => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }));

  const toggleChop = (id) =>
    set('chopeiras', f.chopeiras.includes(id) ? f.chopeiras.filter((x) => x !== id) : [...f.chopeiras, id]);

  const viasSel = chopeiras
    .filter((c) => f.chopeiras.includes(c.id))
    .reduce((s, c) => s + c.vias, 0);
  const numCervejas = f.itens.length;

  const total = calcTotal(f);
  const valido =
    f.cliente &&
    f.telefone &&
    f.data_entrega &&
    f.chopeiras.length > 0 &&
    f.itens.some((it) => it.cerveja && it.litros);

  async function handleSave() {
    if (!valido) return;

    try {
      setSaving(true);
      setError(null);

      const res = await fetch('/api/publico/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente: f.cliente,
          telefone: f.telefone,
          data_entrega: f.data_entrega,
          gas: f.gas,
          valor_entrega_coleta: f.valor_entrega_coleta || 0,
          itens: f.itens.filter((it) => it.cerveja && it.litros),
          chopeiras: f.chopeiras,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.erro || 'Erro ao criar pedido');
      }

      const data = await res.json();
      setSucesso(`✓ Pedido criado! ID: #${data.pedido.id}. Entraremos em contato em breve.`);

      // Limpar form
      setTimeout(() => {
        setF({
          cliente: '',
          telefone: '',
          data_entrega: '',
          itens: [{ cerveja: 'Predileta', litros: '', valor_litro: '' }],
          chopeiras: [],
          gas: false,
          valor_entrega_coleta: '',
        });
        setSucesso(null);
      }, 5000);
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
      <div style={{ marginBottom: '24px', padding: '16px', background: '#ede9fe', borderRadius: '10px' }}>
        <h2 style={{ marginTop: 0, color: '#6366f1' }}>📅 Agende sua Entrega de Chopp</h2>
        <p style={{ color: '#6b7280', marginBottom: 0 }}>
          Preencha os dados abaixo e confirmaremos sua reserva em breve. Sem compromisso!
        </p>
      </div>

      {error && <div className="error">{error}</div>}
      {sucesso && <div style={{ background: '#d1fae5', color: '#10b981', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px' }}>{sucesso}</div>}

      <div className="form">
        <div className="fgrid">
          <Field label="Seu nome *" span2>
            <input
              value={f.cliente}
              onChange={(e) => set('cliente', e.target.value)}
              placeholder="Ex.: João Silva"
            />
          </Field>
          <Field label="WhatsApp / Telefone *">
            <input
              value={f.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(51) 99999-9999"
            />
          </Field>
          <Field label="Data desejada *">
            <input
              type="date"
              value={f.data_entrega}
              onChange={(e) => set('data_entrega', e.target.value)}
            />
          </Field>
        </div>

        <div className="fblock">
          <label className="lbl">Cervejas desejadas *</label>
          <div className="itemHead">
            <span>Rótulo</span>
            <span>Litros</span>
            <span>R$/L</span>
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
          <label className="lbl">Chopeiras *</label>
          <p style={{ fontSize: '12px', color: '#6b7280', margin: '0 0 10px 0' }}>
            Cada via serve 1 rótulo. Você pode revezar cervejas na mesma via ao longo do evento.
          </p>
          <div className="pickGrid">
            {chopeiras.map((c) => {
              const on = f.chopeiras.includes(c.id);
              return (
                <button
                  key={c.id}
                  disabled={!f.data_entrega}
                  className={`pick ${on ? 'on' : ''} ${c.tipo === 'Gelo' ? 'gelo' : ''}`}
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
                </button>
              );
            })}
          </div>
          {f.chopeiras.length > 0 && (
            <div className={`capMsg ${viasSel >= numCervejas ? 'ok' : 'warn'}`}>
              {viasSel} {viasSel === 1 ? 'via' : 'vias'} selecionada(s)
            </div>
          )}
          <label className="check">
            <input
              type="checkbox"
              checked={f.gas}
              onChange={(e) => set('gas', e.target.checked)}
            />
            Preciso de gás (tem custo)
          </label>
        </div>

        <div className="fgrid">
          <Field label="Taxa de entrega + recolhimento (R$)">
            <input
              type="number"
              value={f.valor_entrega_coleta}
              onChange={(e) => set('valor_entrega_coleta', e.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <div className="formFoot">
          <div className="totalBox">
            <span>Total estimado</span>
            <b>{brl(total)}</b>
          </div>
          <button className="save" disabled={!valido || saving} onClick={handleSave}>
            {saving ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </div>

        <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '16px', textAlign: 'center' }}>
          Ao enviar, você concorda que entraremos em contato para confirmar disponibilidade e finalizar os detalhes.
        </p>
      </div>
    </main>
  );
}
