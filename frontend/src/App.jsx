import { useState, useEffect } from 'react';
import { getPedidos, confirmPedido, updatePedido } from './services/api';
import Agenda from './components/Agenda';
import Disponibilidade from './components/Disponibilidade';
import NovoPedido from './components/NovoPedido';
import Pendentes from './components/Pendentes';
import AgendarPublico from './components/AgendarPublico';

export default function App() {
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('agenda');
  const [dispData, setDispData] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modo, setModo] = useState('admin'); // admin ou cliente

  // Carregar pedidos na montagem
  useEffect(() => {
    loadPedidos();
  }, []);

  async function loadPedidos() {
    try {
      setLoading(true);
      setError(null);
      const data = await getPedidos();
      setOrders(data);
    } catch (err) {
      setError(err.message);
      console.error('Erro ao carregar pedidos:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(id) {
    try {
      await confirmPedido(id);
      setOrders((o) => o.map((x) => (x.id === id ? { ...x, status: 'confirmado' } : x)));
    } catch (err) {
      setError(`Erro ao confirmar: ${err.message}`);
    }
  }

  async function handleTogglePago(id) {
    try {
      const order = orders.find((o) => o.id === id);
      await updatePedido(id, { pago: !order.pago });
      setOrders((o) => o.map((x) => (x.id === id ? { ...x, pago: !x.pago } : x)));
    } catch (err) {
      setError(`Erro ao atualizar: ${err.message}`);
    }
  }

  async function handleSaveNew(newOrder) {
    try {
      await loadPedidos();
      setTab('agenda');
    } catch (err) {
      setError(`Erro ao criar pedido: ${err.message}`);
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <span className="mark">▲</span>
          <div>
            <h1>Agenda de Chopp</h1>
            <p>Fora da Lei · entregas e chopeiras</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            style={{
              background: modo === 'admin' ? '#6366f1' : '#e0e3e8',
              color: modo === 'admin' ? '#ffffff' : '#1a202c',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
            onClick={() => {
              setModo('admin');
              setTab('agenda');
            }}
          >
            👤 Admin
          </button>
          <button
            style={{
              background: modo === 'cliente' ? '#6366f1' : '#e0e3e8',
              color: modo === 'cliente' ? '#ffffff' : '#1a202c',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
            }}
            onClick={() => {
              setModo('cliente');
              setTab('agendar');
            }}
          >
            🔗 Cliente
          </button>
        </div>
        <nav className="tabs">
          {modo === 'admin' &&
            [
              ['agenda', 'Agenda'],
              ['pendentes', 'Pendentes'],
              ['disp', 'Disponibilidade'],
              ['novo', 'Novo pedido'],
            ].map(([k, l]) => (
              <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          {modo === 'cliente' && (
            <button className={tab === 'agendar' ? 'tab on' : 'tab'} onClick={() => setTab('agendar')}>
              Agendar Chopp
            </button>
          )}
        </nav>
      </header>

      {error && (
        <div className="body">
          <div className="error">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="body">
          <div className="loading">Carregando...</div>
        </div>
      ) : (
        <>
          {modo === 'admin' && (
            <>
              {tab === 'agenda' && (
                <Agenda
                  orders={orders}
                  onConfirm={handleConfirm}
                  onTogglePago={handleTogglePago}
                />
              )}
              {tab === 'pendentes' && (
                <Pendentes
                  orders={orders}
                  onRefresh={loadPedidos}
                />
              )}
              {tab === 'disp' && (
                <Disponibilidade
                  data={dispData}
                  setData={setDispData}
                  orders={orders}
                />
              )}
              {tab === 'novo' && (
                <NovoPedido
                  orders={orders}
                  onSave={handleSaveNew}
                />
              )}
            </>
          )}
          {modo === 'cliente' && tab === 'agendar' && <AgendarPublico />}
        </>
      )}
    </div>
  );
}
