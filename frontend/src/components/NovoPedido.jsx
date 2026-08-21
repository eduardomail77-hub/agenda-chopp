import { createPedido } from '../services/api';
import FormPedido from './FormPedido';

export default function NovoPedido({ orders = [], onSave }) {
  async function handleSubmit(dados) {
    await createPedido(dados);
    onSave();
  }

  return (
    <main className="body">
      <FormPedido orders={orders} onSubmit={handleSubmit} />
    </main>
  );
}
