import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const TIPOS = [
  { valor: 'eletrica', titulo: 'Elétrica', ajuda: 'Precisa de tomada 220V no local' },
  { valor: 'gelo', titulo: 'Gelo', ajuda: 'Não precisa de energia' },
  { valor: 'indiferente', titulo: 'Não sei', ajuda: 'A gente te orienta' },
];

const hoje = new Date().toISOString().split('T')[0];

export default function CotacaoPublica() {
  const [cervejas, setCervejas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const [protocolo, setProtocolo] = useState(null);

  const [f, setF] = useState({
    cliente: '',
    telefone: '',
    endereco: '',
    data_entrega: '',
    hora_entrega: '',
    data_coleta: '',
    hora_coleta: '',
    tipo_chopeira: 'indiferente',
    pessoas: '',
    observacoes: '',
    itens: [{ cerveja: '', litros: '' }],
  });

  useEffect(() => {
    fetch(`${API_URL}/publico/catalogo`)
      .then((r) => r.json())
      .then((d) => setCervejas(d.cervejas || []))
      .catch(() => setErro('Não consegui carregar as cervejas, recarregue a página'))
      .finally(() => setCarregando(false));
  }, []);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const setItem = (i, k, v) =>
    setF((p) => ({ ...p, itens: p.itens.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)) }));

  const addItem = () => setF((p) => ({ ...p, itens: [...p.itens, { cerveja: '', litros: '' }] }));

  const rmItem = (i) =>
    setF((p) => ({ ...p, itens: p.itens.filter((_, idx) => idx !== i) }));

  const valido =
    f.cliente.trim() && f.telefone.trim() && f.data_entrega && f.itens.some((i) => i.cerveja);

  async function enviar(e) {
    e.preventDefault();
    if (!valido) return;

    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch(`${API_URL}/publico/cotacoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, itens: f.itens.filter((i) => i.cerveja) }),
      });
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.erro || 'Não consegui enviar');
      setProtocolo(dados.protocolo);
    } catch (err) {
      setErro(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (protocolo) {
    return (
      <div className="cotacaoWrap">
        <div className="cotacaoCard sucesso">
          <span className="mark grande">▲</span>
          <h1>Recebemos seu pedido</h1>
          <p className="protocolo">Cotação nº {protocolo}</p>
          <p>
            A gente vai montar o orçamento e retornar pelo WhatsApp no número que você informou.
            Não precisa fazer mais nada por aqui.
          </p>
          <p className="assinatura">Cervejaria Fora da Lei</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cotacaoWrap">
      <form className="cotacaoCard" onSubmit={enviar}>
        <header className="cotacaoTopo">
          <span className="mark grande">▲</span>
          <div>
            <h1>Peça sua cotação de chopp</h1>
            <p>
              Cervejaria Fora da Lei · preencha os dados do seu evento e a gente
              retorna o orçamento pelo WhatsApp
            </p>
          </div>
        </header>

        {erro && <div className="error">{erro}</div>}

        <section className="cotacaoBloco">
          <h2>Seus dados</h2>
          <label className="field">
            <span>Seu nome *</span>
            <input value={f.cliente} onChange={(e) => set('cliente', e.target.value)} required />
          </label>
          <label className="field">
            <span>WhatsApp *</span>
            <input
              value={f.telefone}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(51) 9 9999-9999"
              required
            />
          </label>
          <label className="field">
            <span>Endereço do evento</span>
            <input
              value={f.endereco}
              onChange={(e) => set('endereco', e.target.value)}
              placeholder="Rua, número, bairro, cidade"
            />
          </label>
          <label className="field">
            <span>Quantas pessoas, mais ou menos?</span>
            <input
              type="number"
              min="1"
              value={f.pessoas}
              onChange={(e) => set('pessoas', e.target.value)}
              placeholder="Ajuda a gente a sugerir a quantidade"
            />
          </label>
        </section>

        <section className="cotacaoBloco">
          <h2>Quando</h2>
          <div className="cotacaoGrid">
            <label className="field">
              <span>Data da entrega *</span>
              <input
                type="date"
                min={hoje}
                value={f.data_entrega}
                onChange={(e) => {
                  set('data_entrega', e.target.value);
                  if (f.data_coleta && f.data_coleta < e.target.value) {
                    set('data_coleta', e.target.value);
                  }
                }}
                required
              />
            </label>
            <label className="field">
              <span>Hora da entrega</span>
              <input
                type="time"
                value={f.hora_entrega}
                onChange={(e) => set('hora_entrega', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Data do recolhimento</span>
              <input
                type="date"
                min={f.data_entrega || hoje}
                value={f.data_coleta}
                onChange={(e) => set('data_coleta', e.target.value)}
              />
            </label>
            <label className="field">
              <span>Hora do recolhimento</span>
              <input
                type="time"
                value={f.hora_coleta}
                onChange={(e) => set('hora_coleta', e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="cotacaoBloco">
          <h2>Qual chopp você quer</h2>
          {carregando ? (
            <div className="loading">Carregando cervejas...</div>
          ) : (
            <>
              {f.itens.map((it, i) => (
                <div className="cotacaoItem" key={i}>
                  <label className="field">
                    <span>Cerveja</span>
                    <select
                      value={it.cerveja}
                      onChange={(e) => setItem(i, 'cerveja', e.target.value)}
                    >
                      <option value="">Escolha um rótulo</option>
                      {cervejas.map((c) => (
                        <option key={c.nome} value={c.nome}>
                          {c.nome} — {c.estilo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Litros</span>
                    <input
                      type="number"
                      min="1"
                      value={it.litros}
                      onChange={(e) => setItem(i, 'litros', e.target.value)}
                      placeholder="Ex.: 50"
                    />
                  </label>
                  {f.itens.length > 1 && (
                    <button type="button" className="rmItem" onClick={() => rmItem(i)} title="Remover">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className="addItem" onClick={addItem}>
                + Adicionar outra cerveja
              </button>
            </>
          )}
        </section>

        <section className="cotacaoBloco">
          <h2>Tipo de chopeira</h2>
          <div className="tipoGrid">
            {TIPOS.map((t) => (
              <label
                key={t.valor}
                className={`tipoOpcao ${f.tipo_chopeira === t.valor ? 'on' : ''}`}
              >
                <input
                  type="radio"
                  name="tipo"
                  value={t.valor}
                  checked={f.tipo_chopeira === t.valor}
                  onChange={(e) => set('tipo_chopeira', e.target.value)}
                />
                <b>{t.titulo}</b>
                <small>{t.ajuda}</small>
              </label>
            ))}
          </div>
        </section>

        <section className="cotacaoBloco">
          <h2>Mais alguma coisa?</h2>
          <label className="field">
            <span>Observações</span>
            <textarea
              rows="3"
              value={f.observacoes}
              onChange={(e) => set('observacoes', e.target.value)}
              placeholder="Tipo de evento, se tem escada, onde fica a tomada, qualquer detalhe que ajude"
            />
          </label>
        </section>

        <button className="btn-primary grande" type="submit" disabled={!valido || enviando}>
          {enviando ? 'Enviando...' : 'Pedir cotação'}
        </button>
        <p className="cotacaoRodape">
          É só um pedido de orçamento, não compromete nada. A gente retorna pelo WhatsApp.
        </p>
      </form>
    </div>
  );
}
