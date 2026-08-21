import { useState, useEffect } from 'react';
import { getPedidos, confirmPedido, updatePedido, deletePedido } from '../services/api';
import Row from './common/Row';

const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcTotal = (o) =>
  (o.itens || []).reduce((s, it) => s + (Number(it.litros) || 0) * (Number(it.valor_litro) || 0), 0) +
  (Number(o.valor_entrega_coleta) || 0) -
  (Number(o.desconto) || 0);

const totalLitros = (o) => (o.itens || []).reduce((s, it) => s + (Number(it.litros) || 0), 0);

/** A API devolve a data em ISO completo; aqui só interessa YYYY-MM-DD. */
const soData = (s) => (s ? String(s).split('T')[0] : '');

const diaSemana = (s) => {
  const d = soData(s);
  if (!d) return '';
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(`${d}T12:00:00`).getDay()];
};

const dataCurta = (s) => {
  const d = soData(s);
  if (!d) return 'a definir';
  const [ano, mes, dia] = d.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
};

const hora = (h) => (h ? String(h).slice(0, 5) : null);

const momento = (data, h, resp) => {
  const partes = [dataCurta(data)];
  if (hora(h)) partes.push(`às ${hora(h)}`);
  partes.push(resp || 'responsável a definir');
  return partes.join(' · ');
};

export default function Pendentes({ orders, ehAdmin, onRefresh }) {
  const [confirmando, setConfirmando] = useState(null);
  const [editando, setEditando] = useState(null);
  const [erro, setErro] = useState(null);

  const pendentes = orders.filter((o) => o.status === 'pendente');

  async function handleConfirmar(id) {
    try {
      setConfirmando(id);
      setErro(null);
      await confirmPedido(id);
      onRefresh();
    } catch (err) {
      setErro(err.message);
    } finally {
      setConfirmando(null);
    }
  }

  async function handleDeletar(id) {
    if (!confirm('Deletar este pedido?')) return;
    try {
      setErro(null);
      await deletePedido(id);
      onRefresh();
    } catch (err) {
      setErro(err.message);
    }
  }

  async function handleAtualizar(id, data) {
    try {
      setErro(null);
      await updatePedido(id, data);
      setEditando(null);
      onRefresh();
    } catch (err) {
      setErro(err.message);
    }
  }

  if (pendentes.length === 0) {
    return (
      <main className="body">
        <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
          <p style={{ fontSize: '18px', marginBottom: '10px' }}>✓ Nenhum pedido pendente</p>
          <p>Todos os pedidos foram confirmados!</p>
        </div>
      </main>
    );
  }

  return (
    <main className="body">
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#f59e0b' }}>⏳ Pedidos Pendentes de Confirmação</h2>
        <p style={{ color: '#6b7280', margin: '5px 0 0' }}>{pendentes.length} pedido(s) aguardando revisão</p>
      </div>

      {erro && <div className="error">{erro}</div>}

      <div className="grid">
        {pendentes.map((o) => (
          <article key={o.id} className={`card ${o.status}`}>
            <div className="cardTop">
              <div className="dateChip">
                <span className="dnum">{soData(o.data_entrega).split('-')[2]}</span>
                <span className="dinfo">
                  {soData(o.data_entrega).split('-')[1]}/{soData(o.data_entrega).slice(2, 4)}
                  <br />
                  {diaSemana(o.data_entrega)}
                </span>
              </div>
              <div className="cliente">
                <h3 style={{ margin: 0 }}>{o.cliente}</h3>
                <span className="tel">{o.telefone}</span>
                {o.endereco && <span className="endereco">{o.endereco}</span>}
              </div>
              <span className={`badge ${o.status}`}>Pendente</span>
            </div>

            <div className="rows">
              <div className="row beers">
                <span className="rl">{o.itens?.length > 1 ? 'Cervejas' : 'Cerveja'}</span>
                <span className="rv beerList">
                  {o.itens?.map((it, i) => (
                    <span key={i} className="beerLine">
                      {it.cerveja} · {it.litros} L
                    </span>
                  ))}
                  {o.itens?.length > 1 && <span className="beerSum">{totalLitros(o)} L total</span>}
                </span>
              </div>
              <Row label="Chopeiras" v={o.chopeiras?.join('  ·  ') || 'N/A'} />
              <Row label="Entrega" v={momento(o.data_entrega, o.hora_entrega, o.resp_entrega)} />
              <Row label="Recolhimento" v={momento(o.data_coleta, o.hora_coleta, o.resp_coleta)} />
            </div>

            <div className="cardBottom">
              <div className="total">
                <span>Total</span>
                <b>{brl(calcTotal(o))}</b>
              </div>
              {ehAdmin && (
                <div className="actions" style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className="confirm"
                    onClick={() => handleConfirmar(o.id)}
                    disabled={confirmando === o.id}
                  >
                    {confirmando === o.id ? 'Confirmando...' : 'Confirmar'}
                  </button>
                  <button
                    style={{
                      border: '0',
                      background: '#fee2e2',
                      color: '#ef4444',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontWeight: '600',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleDeletar(o.id)}
                  >
                    Rejeitar
                  </button>
                </div>
              )}
            </div>

            <p className="hint">
              {ehAdmin
                ? 'Revise a disponibilidade antes de confirmar. Ao confirmar, o evento entra no Google Agenda com os lembretes configurados.'
                : 'Aguardando um administrador conferir a disponibilidade e confirmar.'}
            </p>
          </article>
        ))}
      </div>
    </main>
  );
}
