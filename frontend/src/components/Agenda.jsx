import Row from './common/Row';

const brl = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const calcTotal = (o) =>
  (o.itens || []).reduce((s, it) => s + (Number(it.litros) || 0) * (Number(it.valor_litro) || 0), 0) +
  (Number(o.valor_entrega_coleta) || 0) -
  (Number(o.desconto) || 0);

const totalLitros = (o) => (o.itens || []).reduce((s, it) => s + (Number(it.litros) || 0), 0);

const diaSemana = (s) => {
  if (!s) return '';
  const dt = new Date(s + 'T12:00:00');
  return ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][dt.getDay()];
};

export default function Agenda({ orders, ehAdmin, onConfirm, onTogglePago }) {
  const sorted = [...orders].sort((a, b) => a.data_entrega.localeCompare(b.data_entrega));
  const pendentes = sorted.filter((o) => o.status === 'pendente').length;

  return (
    <main className="body">
      {pendentes > 0 && (
        <div className="alert">
          <b>{pendentes}</b> {pendentes === 1 ? 'pedido pendente' : 'pedidos pendentes'} aguardando você conferir disponibilidade e confirmar.
        </div>
      )}
      <div className="grid">
        {sorted.map((o) => (
          <article key={o.id} className={`card ${o.status}`}>
            <div className="cardTop">
              <div className="dateChip">
                <span className="dnum">{o.data_entrega.split('-')[2]}</span>
                <span className="dinfo">
                  {o.data_entrega.split('-')[1]}/{o.data_entrega.slice(2, 4)}
                  <br />
                  {diaSemana(o.data_entrega)}
                </span>
              </div>
              <div className="cliente">
                <h3>{o.cliente}</h3>
                <span className="tel">{o.telefone}</span>
              </div>
              <span className={`badge ${o.status}`}>
                {o.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
              </span>
            </div>

            <div className="rows">
              <div className="row beers">
                <span className="rl">{o.itens?.length > 1 ? 'Cervejas' : 'Cerveja'}</span>
                <span className="rv beerList">
                  {o.itens?.map((it, i) => (
                    <span key={i} className="beerLine">
                      {it.cerveja} <span className="beerEst">— Cerveja</span> · {it.litros} L
                    </span>
                  ))}
                  {o.itens?.length > 1 && <span className="beerSum">{totalLitros(o)} L no total</span>}
                </span>
              </div>
              <Row label="Chopeiras" v={o.chopeiras?.join('  ·  ') || 'N/A'} />
              <Row label="Entrega" v={o.resp_entrega || <em className="miss">definir</em>} />
              <Row label="Coleta" v={o.resp_coleta || <em className="miss">definir</em>} />
            </div>

            <div className="cardBottom">
              <div className="total">
                <span>Total</span>
                <b>{brl(calcTotal(o))}</b>
              </div>
              <div className="actions">
                <button className={`pgto ${o.pago ? 'ok' : 'no'}`} onClick={() => onTogglePago(o.id)}>
                  {o.pago ? 'Pago' : 'A receber'}
                </button>
                {o.status === 'pendente' && ehAdmin && (
                  <button className="confirm" onClick={() => onConfirm(o.id)}>
                    Confirmar
                  </button>
                )}
              </div>
            </div>
            {o.status === 'pendente' && (
              <p className="hint">
                {ehAdmin
                  ? 'Ao confirmar, o sistema cria o evento no Google Agenda com os lembretes definidos em Configurações.'
                  : 'Aguardando um administrador confirmar.'}
              </p>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
