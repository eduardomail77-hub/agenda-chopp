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

/** "15/09/26 às 10:00 · Eduardo" */
const momento = (data, h, resp) => {
  const partes = [dataCurta(data)];
  if (hora(h)) partes.push(`às ${hora(h)}`);
  partes.push(resp || 'responsável a definir');
  return partes.join(' · ');
};

export default function Agenda({ orders, ehAdmin, podeEditar, onEditar, onConfirm, onTogglePago }) {
  const sorted = [...orders].sort((a, b) =>
    soData(a.data_entrega).localeCompare(soData(b.data_entrega))
  );
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
                <span className="dnum">{soData(o.data_entrega).split('-')[2]}</span>
                <span className="dinfo">
                  {soData(o.data_entrega).split('-')[1]}/{soData(o.data_entrega).slice(2, 4)}
                  <br />
                  {diaSemana(o.data_entrega)}
                </span>
              </div>
              <div className="cliente">
                <h3>{o.cliente}</h3>
                <span className="tel">{o.telefone}</span>
                {o.endereco && <span className="endereco">{o.endereco}</span>}
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
              <Row label="Entrega" v={momento(o.data_entrega, o.hora_entrega, o.resp_entrega)} />
              <Row label="Recolhimento" v={momento(o.data_coleta, o.hora_coleta, o.resp_coleta)} />
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
                {podeEditar?.(o) && (
                  <button className="editar" onClick={() => onEditar(o)}>
                    Editar
                  </button>
                )}
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
