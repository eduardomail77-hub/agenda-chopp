import { useEffect } from 'react';
import { updatePedido } from '../services/api';
import FormPedido from './FormPedido';

export default function EditarPedido({ pedido, orders, onSalvo, onFechar }) {
  // Esc fecha, e a página atrás não rola junto com o modal
  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [onFechar]);

  async function handleSubmit(dados) {
    const salvo = await updatePedido(pedido.id, dados);
    onSalvo(salvo);
  }

  return (
    <div className="modalFundo" onClick={onFechar}>
      <div className="modalCaixa" onClick={(e) => e.stopPropagation()}>
        <div className="modalTopo">
          <div>
            <h2>Editar pedido</h2>
            <p className="hint" style={{ margin: 0 }}>
              {pedido.cliente}
              {pedido.status === 'confirmado' &&
                ' · já confirmado, salvar atualiza os eventos no Google Agenda'}
            </p>
          </div>
          <button className="modalFechar" onClick={onFechar} title="Fechar">
            ✕
          </button>
        </div>

        <FormPedido
          pedido={pedido}
          orders={orders}
          onSubmit={handleSubmit}
          onCancel={onFechar}
          textoBotao="Salvar alterações"
        />
      </div>
    </div>
  );
}
