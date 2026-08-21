import { useState, useEffect } from 'react';
import {
  getUsuarios,
  criarUsuario,
  atualizarUsuario,
  getPreferencias,
  salvarPreferencias,
  getCervejas,
  criarCerveja,
  atualizarCerveja,
  getChopeiras,
  criarChopeira,
  atualizarChopeira,
  getStatusGoogle,
  trocarSenha,
} from '../services/api';

const SECOES = [
  ['equipe', 'Equipe'],
  ['lembretes', 'Lembretes'],
  ['precos', 'Preços'],
  ['catalogo', 'Catálogo'],
  ['conta', 'Minha conta'],
];

const OPCOES_LEMBRETE = [
  { minutos: 10080, rotulo: '1 semana antes' },
  { minutos: 2880, rotulo: '2 dias antes' },
  { minutos: 1440, rotulo: '1 dia antes' },
  { minutos: 180, rotulo: '3 horas antes' },
  { minutos: 60, rotulo: '1 hora antes' },
  { minutos: 0, rotulo: 'Na hora do evento' },
];

export default function Configuracoes({ usuario }) {
  const [secao, setSecao] = useState('equipe');
  const ehAdmin = usuario.perfil === 'admin';

  return (
    <div className="body">
      <nav className="subtabs">
        {SECOES.map(([k, l]) => (
          <button key={k} className={secao === k ? 'subtab on' : 'subtab'} onClick={() => setSecao(k)}>
            {l}
          </button>
        ))}
      </nav>

      {secao === 'equipe' && <Equipe ehAdmin={ehAdmin} />}
      {secao === 'lembretes' && <Lembretes ehAdmin={ehAdmin} />}
      {secao === 'precos' && <Precos ehAdmin={ehAdmin} />}
      {secao === 'catalogo' && <Catalogo ehAdmin={ehAdmin} />}
      {secao === 'conta' && <MinhaConta usuario={usuario} />}
    </div>
  );
}

function Aviso({ erro, ok }) {
  if (erro) return <div className="error">{erro}</div>;
  if (ok) return <div className="ok">{ok}</div>;
  return null;
}

/* ---------------- Equipe ---------------- */

function Equipe({ ehAdmin }) {
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [novo, setNovo] = useState({ nome: '', email: '', telefone: '', senha: '', perfil: 'vendedor', recebe_aviso: true });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    try { setUsuarios(await getUsuarios()); } catch (e) { setErro(e.message); }
  }

  async function adicionar(e) {
    e.preventDefault();
    setErro(null); setOk(null);
    try {
      await criarUsuario(novo);
      setNovo({ nome: '', email: '', telefone: '', senha: '', perfil: 'vendedor', recebe_aviso: true });
      setOk('Pessoa cadastrada. Se marcou para receber aviso, o convite do calendário foi enviado para o e-mail dela.');
      carregar();
    } catch (e) { setErro(e.message); }
  }

  async function alternar(u, campo) {
    setErro(null); setOk(null);
    try {
      await atualizarUsuario(u.id, { [campo]: !u[campo] });
      carregar();
    } catch (e) { setErro(e.message); }
  }

  return (
    <section className="card">
      <h2>Equipe</h2>
      <p className="hint">
        Quem está marcado em <strong>Recebe aviso</strong> ganha acesso ao calendário do chopp e
        passa a receber os lembretes no celular. Use o e-mail que a pessoa usa no Google.
      </p>

      <Aviso erro={erro} ok={ok} />

      <div className="tabela">
        <div className="tabela-head">
          <span>Nome</span><span>E-mail</span><span>Perfil</span><span>Recebe aviso</span><span>Ativo</span>
        </div>
        {usuarios.map((u) => (
          <div className="tabela-row" key={u.id}>
            <span data-label="Nome">{u.nome}</span>
            <span data-label="E-mail">{u.email}</span>
            <span data-label="Perfil">
              <span className={u.perfil === 'admin' ? 'badge admin' : 'badge'}>{u.perfil}</span>
            </span>
            <span data-label="Recebe aviso">
              <input type="checkbox" checked={u.recebe_aviso} disabled={!ehAdmin}
                onChange={() => alternar(u, 'recebe_aviso')} />
            </span>
            <span data-label="Ativo">
              <input type="checkbox" checked={u.ativo} disabled={!ehAdmin}
                onChange={() => alternar(u, 'ativo')} />
            </span>
          </div>
        ))}
      </div>

      {ehAdmin && (
        <form className="form-inline" onSubmit={adicionar}>
          <h3>Adicionar pessoa</h3>
          <div className="grid-form">
            <label className="field"><span>Nome</span>
              <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
            </label>
            <label className="field"><span>E-mail do Google</span>
              <input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} required />
            </label>
            <label className="field"><span>Telefone</span>
              <input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} placeholder="(51) 9..." />
            </label>
            <label className="field"><span>Senha provisória</span>
              <input type="password" value={novo.senha} minLength={8}
                onChange={(e) => setNovo({ ...novo, senha: e.target.value })} required />
            </label>
            <label className="field"><span>Perfil</span>
              <select value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value })}>
                <option value="vendedor">Vendedor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="field check"><span>Recebe aviso</span>
              <input type="checkbox" checked={novo.recebe_aviso}
                onChange={(e) => setNovo({ ...novo, recebe_aviso: e.target.checked })} />
            </label>
          </div>
          <button className="btn-primary" type="submit">Adicionar</button>
        </form>
      )}
    </section>
  );
}

/* ---------------- Lembretes ---------------- */

function Lembretes({ ehAdmin }) {
  const [selecionados, setSelecionados] = useState([]);
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  useEffect(() => {
    getPreferencias()
      .then((p) => setSelecionados((p.lembretes || '').split(',').filter(Boolean).map(Number)))
      .catch((e) => setErro(e.message));
    getStatusGoogle().then(setStatus).catch(() => {});
  }, []);

  function alternar(minutos) {
    setSelecionados((atual) =>
      atual.includes(minutos) ? atual.filter((m) => m !== minutos) : [...atual, minutos]
    );
  }

  async function salvar() {
    setErro(null); setOk(null);
    if (selecionados.length > 5) {
      setErro('O Google aceita no máximo 5 lembretes por evento');
      return;
    }
    try {
      const ordenados = [...selecionados].sort((a, b) => b - a);
      await salvarPreferencias({ lembretes: ordenados.join(',') });
      setOk('Lembretes salvos. Valem para os próximos pedidos confirmados.');
    } catch (e) { setErro(e.message); }
  }

  return (
    <section className="card">
      <h2>Lembretes</h2>
      <p className="hint">
        Quando o aviso do pedido deve tocar no celular de quem está na equipe.
        Os lembretes valem para os pedidos confirmados a partir de agora.
      </p>

      {status && (
        <div className={status.ok ? 'ok' : 'error'}>
          {status.ok
            ? `Google Agenda conectado: ${status.calendario}`
            : `Google Agenda com problema: ${status.erro}`}
        </div>
      )}

      <Aviso erro={erro} ok={ok} />

      <div className="opcoes">
        {OPCOES_LEMBRETE.map((o) => (
          <label key={o.minutos} className="opcao">
            <input type="checkbox" checked={selecionados.includes(o.minutos)}
              disabled={!ehAdmin} onChange={() => alternar(o.minutos)} />
            <span>{o.rotulo}</span>
          </label>
        ))}
      </div>

      {ehAdmin && <button className="btn-primary" onClick={salvar}>Salvar lembretes</button>}
    </section>
  );
}

/* ---------------- Preços ---------------- */

function Precos({ ehAdmin }) {
  const [cervejas, setCervejas] = useState([]);
  const [prefs, setPrefs] = useState({
    valor_entrega_padrao: '0',
    hora_entrega_padrao: '10:00',
    hora_coleta_padrao: '10:00',
  });
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    try {
      setCervejas(await getCervejas());
      const p = await getPreferencias();
      setPrefs({
        valor_entrega_padrao: p.valor_entrega_padrao || '0',
        hora_entrega_padrao: p.hora_entrega_padrao || '10:00',
        hora_coleta_padrao: p.hora_coleta_padrao || '10:00',
      });
    } catch (e) { setErro(e.message); }
  }

  async function salvar() {
    setErro(null); setOk(null);
    try {
      await Promise.all(
        cervejas.map((c) => atualizarCerveja(c.id, { preco_litro: Number(c.preco_litro) || 0 }))
      );
      await salvarPreferencias(prefs);
      setOk('Padrões salvos. Eles entram preenchidos no pedido, e dá para mudar em cada pedido.');
    } catch (e) { setErro(e.message); }
  }

  const setPref = (k, v) => setPrefs((p) => ({ ...p, [k]: v }));

  return (
    <section className="card">
      <h2>Preços e padrões</h2>
      <p className="hint">
        Valor sugerido por litro de cada rótulo, taxa padrão de entrega e horários que já vêm
        preenchidos no pedido. O vendedor pode alterar tudo em cada pedido.
      </p>

      <Aviso erro={erro} ok={ok} />

      <div className="grid-form">
        <label className="field">
          <span>Entrega, instalação e chopeira (padrão)</span>
          <input type="number" step="0.01" min="0" value={prefs.valor_entrega_padrao} disabled={!ehAdmin}
            onChange={(e) => setPref('valor_entrega_padrao', e.target.value)} />
        </label>
        <label className="field">
          <span>Hora padrão da entrega</span>
          <input type="time" value={prefs.hora_entrega_padrao} disabled={!ehAdmin}
            onChange={(e) => setPref('hora_entrega_padrao', e.target.value)} />
        </label>
        <label className="field">
          <span>Hora padrão do recolhimento</span>
          <input type="time" value={prefs.hora_coleta_padrao} disabled={!ehAdmin}
            onChange={(e) => setPref('hora_coleta_padrao', e.target.value)} />
        </label>
      </div>

      <div className="tabela">
        <div className="tabela-head"><span>Rótulo</span><span>Estilo</span><span>R$ / litro</span></div>
        {cervejas.map((c) => (
          <div className="tabela-row" key={c.id}>
            <span data-label="Rótulo"><strong>{c.nome}</strong></span>
            <span data-label="Estilo">{c.estilo}</span>
            <span data-label="R$ / litro">
              <input type="number" step="0.01" min="0" value={c.preco_litro ?? 0} disabled={!ehAdmin}
                onChange={(e) =>
                  setCervejas((lista) =>
                    lista.map((x) => (x.id === c.id ? { ...x, preco_litro: e.target.value } : x))
                  )
                } />
            </span>
          </div>
        ))}
      </div>

      {ehAdmin && <button className="btn-primary" onClick={salvar}>Salvar preços e padrões</button>}
    </section>
  );
}

/* ---------------- Catálogo ---------------- */

function Catalogo({ ehAdmin }) {
  const [cervejas, setCervejas] = useState([]);
  const [chopeiras, setChopeiras] = useState([]);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [novaCerveja, setNovaCerveja] = useState({ nome: '', estilo: '', abv: '', ibu: '', preco_litro: '' });
  const [novaChopeira, setNovaChopeira] = useState({ id: '', tipo: 'Elétrica', vias: 1, vazao: '' });

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    try {
      setCervejas(await getCervejas());
      setChopeiras(await getChopeiras());
    } catch (e) { setErro(e.message); }
  }

  async function addCerveja(e) {
    e.preventDefault(); setErro(null); setOk(null);
    try {
      await criarCerveja({
        ...novaCerveja,
        abv: novaCerveja.abv || null,
        ibu: novaCerveja.ibu || null,
        preco_litro: novaCerveja.preco_litro || 0,
      });
      setNovaCerveja({ nome: '', estilo: '', abv: '', ibu: '', preco_litro: '' });
      setOk('Cerveja adicionada'); carregar();
    } catch (e) { setErro(e.message); }
  }

  async function addChopeira(e) {
    e.preventDefault(); setErro(null); setOk(null);
    try {
      await criarChopeira({ ...novaChopeira, vazao: novaChopeira.vazao || null });
      setNovaChopeira({ id: '', tipo: 'Elétrica', vias: 1, vazao: '' });
      setOk('Chopeira adicionada'); carregar();
    } catch (e) { setErro(e.message); }
  }

  return (
    <>
      <section className="card">
        <h2>Cervejas</h2>
        <p className="hint">Desmarcar “ativo” tira o rótulo da lista de novos pedidos sem apagar o histórico.</p>
        <Aviso erro={erro} ok={ok} />

        <div className="tabela">
          <div className="tabela-head"><span>Rótulo</span><span>Estilo</span><span>ABV</span><span>IBU</span><span>Ativo</span></div>
          {cervejas.map((c) => (
            <div className="tabela-row" key={c.id}>
              <span data-label="Rótulo"><strong>{c.nome}</strong></span>
              <span data-label="Estilo">{c.estilo}</span>
              <span data-label="ABV">{c.abv}%</span>
              <span data-label="IBU">{c.ibu}</span>
              <span data-label="Ativo">
                <input type="checkbox" checked={c.ativo} disabled={!ehAdmin}
                  onChange={async () => { await atualizarCerveja(c.id, { ativo: !c.ativo }); carregar(); }} />
              </span>
            </div>
          ))}
        </div>

        {ehAdmin && (
          <form className="form-inline" onSubmit={addCerveja}>
            <h3>Nova cerveja</h3>
            <div className="grid-form">
              <label className="field"><span>Rótulo</span>
                <input value={novaCerveja.nome} onChange={(e) => setNovaCerveja({ ...novaCerveja, nome: e.target.value })} required />
              </label>
              <label className="field"><span>Estilo</span>
                <input value={novaCerveja.estilo} onChange={(e) => setNovaCerveja({ ...novaCerveja, estilo: e.target.value })} />
              </label>
              <label className="field"><span>ABV %</span>
                <input type="number" step="0.1" value={novaCerveja.abv} onChange={(e) => setNovaCerveja({ ...novaCerveja, abv: e.target.value })} />
              </label>
              <label className="field"><span>IBU</span>
                <input type="number" value={novaCerveja.ibu} onChange={(e) => setNovaCerveja({ ...novaCerveja, ibu: e.target.value })} />
              </label>
              <label className="field"><span>R$ / litro</span>
                <input type="number" step="0.01" value={novaCerveja.preco_litro} onChange={(e) => setNovaCerveja({ ...novaCerveja, preco_litro: e.target.value })} />
              </label>
            </div>
            <button className="btn-primary" type="submit">Adicionar cerveja</button>
          </form>
        )}
      </section>

      <section className="card">
        <h2>Chopeiras</h2>
        <p className="hint">Código no padrão tipo.vazão.vias.sequência, por exemplo E.40L.1V.2.</p>

        <div className="tabela">
          <div className="tabela-head"><span>Código</span><span>Tipo</span><span>Vias</span><span>Vazão</span><span>Ativa</span></div>
          {chopeiras.map((c) => (
            <div className="tabela-row" key={c.id}>
              <span data-label="Código"><strong>{c.id}</strong></span>
              <span data-label="Tipo">{c.tipo}</span>
              <span data-label="Vias">{c.vias}</span>
              <span data-label="Vazão">{c.vazao ? `${c.vazao} L/h` : '—'}</span>
              <span data-label="Ativa">
                <input type="checkbox" checked={c.ativo} disabled={!ehAdmin}
                  onChange={async () => { await atualizarChopeira(c.id, { ativo: !c.ativo }); carregar(); }} />
              </span>
            </div>
          ))}
        </div>

        {ehAdmin && (
          <form className="form-inline" onSubmit={addChopeira}>
            <h3>Nova chopeira</h3>
            <div className="grid-form">
              <label className="field"><span>Código</span>
                <input value={novaChopeira.id} placeholder="E.40L.1V.2"
                  onChange={(e) => setNovaChopeira({ ...novaChopeira, id: e.target.value })} required />
              </label>
              <label className="field"><span>Tipo</span>
                <select value={novaChopeira.tipo} onChange={(e) => setNovaChopeira({ ...novaChopeira, tipo: e.target.value })}>
                  <option>Elétrica</option><option>Gelo</option>
                </select>
              </label>
              <label className="field"><span>Vias</span>
                <input type="number" min="1" max="4" value={novaChopeira.vias}
                  onChange={(e) => setNovaChopeira({ ...novaChopeira, vias: Number(e.target.value) })} required />
              </label>
              <label className="field"><span>Vazão L/h</span>
                <input type="number" value={novaChopeira.vazao} placeholder="deixe vazio para gelo"
                  onChange={(e) => setNovaChopeira({ ...novaChopeira, vazao: e.target.value })} />
              </label>
            </div>
            <button className="btn-primary" type="submit">Adicionar chopeira</button>
          </form>
        )}
      </section>
    </>
  );
}

/* ---------------- Minha conta ---------------- */

function MinhaConta({ usuario }) {
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);

  async function salvar(e) {
    e.preventDefault(); setErro(null); setOk(null);
    try {
      await trocarSenha(atual, nova);
      setAtual(''); setNova('');
      setOk('Senha alterada');
    } catch (e) { setErro(e.message); }
  }

  return (
    <section className="card">
      <h2>Minha conta</h2>
      <p className="hint">{usuario.nome} · {usuario.email} · perfil {usuario.perfil}</p>

      <Aviso erro={erro} ok={ok} />

      <form className="form-inline" onSubmit={salvar}>
        <h3>Trocar senha</h3>
        <div className="grid-form">
          <label className="field"><span>Senha atual</span>
            <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} required />
          </label>
          <label className="field"><span>Senha nova</span>
            <input type="password" value={nova} minLength={8} onChange={(e) => setNova(e.target.value)} required />
          </label>
        </div>
        <button className="btn-primary" type="submit">Salvar senha</button>
      </form>
    </section>
  );
}
