import { useState, useEffect } from 'react';
import { getPedidos, confirmPedido, updatePedido, getUsuarioSalvo, sair } from './services/api';
import Login from './components/Login';
import Agenda from './components/Agenda';
import Disponibilidade from './components/Disponibilidade';
import NovoPedido from './components/NovoPedido';
import Pendentes from './components/Pendentes';
import Configuracoes from './components/Configuracoes';
import EditarPedido from './components/EditarPedido';
import Cotacoes from './components/Cotacoes';

export default function App() {
  const [usuario, setUsuario] = useState(getUsuarioSalvo());
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('agenda');
  const [dispData, setDispData] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null);

  const ehAdmin = usuario?.perfil === 'admin';

  useEffect(() => {
    function aoExpirar() {
      setUsuario(null);
      setError('Sua sessão expirou, entre de novo');
    }
    window.addEventListener('sessao-expirada', aoExpirar);
    return () => window.removeEventListener('sessao-expirada', aoExpirar);
  }, []);

  useEffect(() => {
    if (usuario) loadPedidos();
  }, [usuario]);

  async function loadPedidos() {
    try {
      setLoading(true);
      setError(null);
      setOrders(await getPedidos());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm(id) {
    try {
      setError(null);
      await confirmPedido(id);
      await loadPedidos();
    } catch (err) {
      setError(`Não consegui confirmar: ${err.message}`);
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

  async function handleSaveNew() {
    await loadPedidos();
    setTab('agenda');
  }

  async function handleSalvarEdicao(salvo) {
    setEditando(null);
    setError(salvo?.aviso || null);
    await loadPedidos();
  }

  // Vendedor ajusta pedido pendente; depois de confirmado só admin mexe,
  // porque a mudança repercute na agenda e na frota
  const podeEditar = (pedido) => ehAdmin || pedido.status === 'pendente';

  function handleSair() {
    sair();
    setUsuario(null);
    setOrders([]);
  }

  if (!usuario) {
    return <Login onEntrar={setUsuario} />;
  }

  // Cotação envolve preço e negociação, então fica só com o administrador
  const abas = [
    ['agenda', 'Agenda'],
    ...(ehAdmin ? [['cotacoes', 'Cotações']] : []),
    ['pendentes', 'Pendentes'],
    ['disp', 'Disponibilidade'],
    ['novo', 'Novo pedido'],
    ['config', 'Configurações'],
  ];

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          <span className="mark">▲</span>
          <div>
            <h1>Agenda de Chopp</h1>
            <p>Fora da Lei · entregas e chopeiras</p>
          </div>
          <div className="sessao">
            <span className="quem">
              {usuario.nome}
              <span className={ehAdmin ? 'badge admin' : 'badge'}>{usuario.perfil}</span>
            </span>
            <button className="btn-sair" onClick={handleSair}>Sair</button>
          </div>
        </div>

        <nav className="tabs">
          {abas.map(([k, l]) => (
            <button key={k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <div className="body">
          <div className="error">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="body"><div className="loading">Carregando...</div></div>
      ) : (
        <>
          {tab === 'agenda' && (
            <Agenda
              orders={orders}
              ehAdmin={ehAdmin}
              podeEditar={podeEditar}
              onEditar={setEditando}
              onConfirm={handleConfirm}
              onTogglePago={handleTogglePago}
            />
          )}
          {tab === 'pendentes' && (
            <Pendentes
              orders={orders}
              ehAdmin={ehAdmin}
              podeEditar={podeEditar}
              onEditar={setEditando}
              onConfirm={handleConfirm}
              onRefresh={loadPedidos}
            />
          )}
          {tab === 'disp' && (
            <Disponibilidade data={dispData} setData={setDispData} orders={orders} />
          )}
          {tab === 'cotacoes' && ehAdmin && (
            <Cotacoes
              ehAdmin={ehAdmin}
              onConvertida={async () => {
                await loadPedidos();
                setTab('pendentes');
              }}
            />
          )}
          {tab === 'novo' && <NovoPedido orders={orders} onSave={handleSaveNew} />}
          {tab === 'config' && <Configuracoes usuario={usuario} />}
        </>
      )}

      {editando && (
        <EditarPedido
          pedido={editando}
          orders={orders}
          onSalvo={handleSalvarEdicao}
          onFechar={() => setEditando(null)}
        />
      )}
    </div>
  );
}
