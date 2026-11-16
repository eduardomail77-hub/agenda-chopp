import { useEffect } from 'react';
import { createPedido, confirmPedido } from '../services/api';
import FormPedido from './FormPedido';

/**
 * Chopp que a casa usa ou vende por conta própria (evento no pub, retirada).
 * Nasce já confirmado, porque o objetivo é justamente segurar as chopeiras,
 * e só pedido confirmado bloqueia frota.
 */
export default function UsoInterno({ orders, interno = true, onFechar, onConcluido }) {
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
    const criado = await createPedido(dados);
    try {
      await confirmPedido(criado.id);
      onConcluido(null);
    } catch (err) {
      // Já existe como pendente; avisa em vez de deixar relançar e duplicar
      onConcluido(`Lançado, mas ficou pendente: ${err.message}. Confirme pela aba Pendentes.`);
    }
  }

  return (
    <div className="modalFundo" onClick={onFechar}>
      <div className="modalCaixa" onClick={(e) => e.stopPropagation()}>
        <div className="modalTopo">
          <div>
            <h2>{interno ? 'Uso interno' : 'Venda direta'}</h2>
            <p className="hint" style={{ margin: 0 }}>
              {interno
                ? 'Chopp da própria casa. Já entra confirmado e bloqueia as chopeiras no período.'
                : 'Venda fechada na hora, por exemplo no balcão. Já entra confirmada e bloqueia as chopeiras no período.'}
            </p>
          </div>
          <button className="modalFechar" onClick={onFechar} title="Fechar">✕</button>
        </div>
        <FormPedido
          orders={orders}
          onSubmit={handleSubmit}
          onCancel={onFechar}
          textoBotao={interno ? 'Lançar e bloquear chopeiras' : 'Lançar venda confirmada'}
          padrao={
            interno
              ? {
                  cliente: 'Fora da Lei (uso interno)',
                  endereco: 'Fora da Lei Pub',
                  valor_entrega_coleta: 0,
                  pago: true,
                }
              : null
          }
        />
      </div>
    </div>
  );
}
