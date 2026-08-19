import { useState, useEffect } from 'react';
import { getChopeiras } from '../services/api';

const viasTxt = (v) => `${v} via${v > 1 ? 's' : ''}`;

export default function Disponibilidade({ data, setData, orders }) {
  const [chopeiras, setChopeiras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChopeiras();
  }, []);

  async function loadChopeiras() {
    try {
      const data = await getChopeiras();
      setChopeiras(data);
    } catch (err) {
      console.error('Erro ao carregar chopeiras:', err);
    } finally {
      setLoading(false);
    }
  }

  const ocupadas = new Set();
  orders.forEach((o) => {
    if (o.data_entrega === data && o.status === 'confirmado') {
      o.chopeiras?.forEach((c) => ocupadas.add(c));
    }
  });

  const donoDe = (cid) => {
    const o = orders.find((x) => x.data_entrega === data && x.chopeiras?.includes(cid));
    return o ? o.cliente : null;
  };

  const livres = chopeiras.filter((c) => !ocupadas.has(c.id)).length;
  const doDia = orders.filter((o) => o.data_entrega === data);

  if (loading) {
    return (
      <main className="body">
        <div className="loading">Carregando chopeiras...</div>
      </main>
    );
  }

  return (
    <main className="body">
      <div className="dispHead">
        <div>
          <label className="lbl">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="date"
          />
        </div>
        <div className="dispCount">
          <b>{livres}</b> de {chopeiras.length} livres
        </div>
      </div>
      <div className="chopGrid">
        {chopeiras.map((c) => {
          const ocup = ocupadas.has(c.id);
          return (
            <div key={c.id} className={`chop ${ocup ? 'busy' : 'free'} ${c.tipo === 'Gelo' ? 'gelo' : 'eletrica'}`}>
              <div className="chopHead">
                <div className="chopId">{c.id}</div>
                <span className={`viasBadge v${c.vias}`}>{viasTxt(c.vias)}</span>
              </div>
              <div className="chopMeta">
                <span className="ctipo">{c.tipo}</span>
                {c.vazao && <span className="cvaz">{c.vazao} L/h</span>}
              </div>
              <div className="chopStatus">
                {ocup ? (
                  <>
                    Ocupada
                    <br />
                    <small>{donoDe(c.id)}</small>
                  </>
                ) : (
                  'Livre'
                )}
              </div>
            </div>
          );
        })}
      </div>
      {doDia.length === 0 && <p className="empty">Nenhuma entrega nessa data. Frota inteira livre.</p>}
    </main>
  );
}
