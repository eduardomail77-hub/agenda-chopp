import { useState, useEffect } from 'react';
import {
  getUsuarios,
  criarUsuario,
  atualizarUsuario,
  reenviarConviteCalendario,
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

const NOVO_VAZIO = {
  nome: '', email: '', telefone: '', senha: '',
  perfil: 'vendedor', recebe_aviso: true,
};

function Equipe({ ehAdmin }) {
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState(null);
  const [ok, setOk] = useState(null);
  const [novo, setNovo] = useState(NOVO_VAZIO);
  const [editando, setEditando] = useState(null);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    try { setUsuarios(await getUsuarios()); } catch (e) { setErro(e.message); }
  }

  async function adicionar(e) {
    e.preventDefault();
    setErro(null); setOk(null);
    try {
      await criarUsuario(novo);
      setNovo(NOVO_VAZIO);
      setOk('Pessoa cadastrada. Se marcou para receber aviso, o convite do calendário já foi enviado.');
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

  async function reenviar(u) {
    setErro(null); setOk(null);
    try {
      const r = await reenviarConviteCalendario(u.id);
      setOk(r.mensagem);
      carregar();
    } catch (e) { setErro(e.message); }
  }

  const semAcesso = usuarios.filter((u) => u.ativo && u.recebe_aviso && u.acesso_calendario === false);

  return (
    <section className="card">
      <h2>Equipe</h2>
      <p className="hint">
        Quem está marcado em <strong>Recebe aviso</strong> ganha acesso ao calendário do chopp e
        passa a receber os lembretes no celular. Use o e-mail que a pessoa usa no Google.
      </p>

      <Aviso erro={erro} ok={ok} />

      {semAcesso.length > 0 && (
        <div className="error">
          {semAcesso.length === 1
            ? `${semAcesso[0].nome} ainda não enxerga o calendário e não vai receber lembrete.`
            : `${semAcesso.length} pessoas ainda não enxergam o calendário e não vão receber lembrete.`}{' '}
          Use o botão Reenviar na linha de cada uma.
        </div>
      )}

      <div className="tabela">
        <div className="tabela-head">
          <span>Nome</span><span>E-mail do Google</span><span>Perfil</span>
          <span>Aviso</span><span>Calendário</span><span>Ativo</span><span></span>
        </div>
        {usuarios.map((u) => (
          <div className="tabela-row" key={u.id}>
            <span data-label="Nome">{u.nome}</span>
            <span data-label="E-mail do Google">{u.email}</span>
            <span data-label="Perfil">
              <span className={u.perfil === 'admin' ? 'badge admin' : 'badge'}>{u.perfil}</span>
            </span>
            <span data-label="Aviso">
              <input type="checkbox" checked={u.recebe_aviso} disabled={!ehAdmin}
                onChange={() => alternar(u, 'recebe_aviso')} />
            </span>
            <span data-label="Calendário">
              {u.acesso_calendario === null ? (
                <em className="miss">não verificado</em>
              ) : u.acesso_calendario ? (
                <span className="statusOk">recebendo</span>
              ) : (
                <span className="statusFalta">
                  sem acesso
                  {ehAdmin && (
                    <button className="linkBtn" onClick={() => reenviar(u)}>Reenviar</button>
                  )}
                </span>
              )}
            </span>
            <span data-label="Ativo">
              <input type="checkbox" checked={u.ativo} disabled={!ehAdmin}
                onChange={() => alternar(u, 'ativo')} />
            </span>
            <span data-label="">
              {ehAdmin && (
                <button className="editar" onClick={() => setEditando(u)}>Editar</button>
              )}
            </span>
          </div>
        ))}
      </div>

      {editando && (
        <EditarPessoa
          pessoa={editando}
          onFechar={() => setEditando(null)}
          onSalvo={(msg) => {
            setEditando(null);
            setOk(msg);
            carregar();
          }}
        />
      )}

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

function EditarPessoa({ pessoa, onFechar, onSalvo }) {
  const [f, setF] = useState({
    nome: pessoa.nome || '',
    email: pessoa.email || '',
    telefone: pessoa.telefone || '',
    perfil: pessoa.perfil,
    senha: '',
  });
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [onFechar]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const dados = {
        nome: f.nome,
        email: f.email,
        telefone: f.telefone,
        perfil: f.perfil,
      };
      // Senha em branco significa manter a atual
      if (f.senha) dados.senha = f.senha;

      await atualizarUsuario(pessoa.id, dados);

      const novoEmail = f.email.toLowerCase().trim();
      const trocouEmail = novoEmail !== pessoa.email.toLowerCase().trim();

      onSalvo(
        trocouEmail
          ? `Dados salvos. O calendário foi compartilhado com ${novoEmail}, e o acesso do e-mail antigo foi removido.`
          : 'Dados salvos.'
      );
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modalFundo" onClick={onFechar}>
      <div className="modalCaixa estreita" onClick={(e) => e.stopPropagation()}>
        <div className="modalTopo">
          <div>
            <h2>Editar pessoa</h2>
            <p className="hint" style={{ margin: 0 }}>{pessoa.nome}</p>
          </div>
          <button className="modalFechar" onClick={onFechar} title="Fechar">✕</button>
        </div>

        <form className="form" onSubmit={salvar}>
          {erro && <div className="error">{erro}</div>}

          <label className="field"><span>Nome</span>
            <input value={f.nome} onChange={(e) => set('nome', e.target.value)} required />
          </label>

          <label className="field"><span>E-mail do Google</span>
            <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} required />
          </label>
          <p className="hint" style={{ marginTop: '-8px' }}>
            É com este e-mail que a pessoa entra no sistema e é nele que o calendário
            é compartilhado. Use a conta do Google que ela abre no celular.
          </p>

          <label className="field"><span>Telefone</span>
            <input value={f.telefone} onChange={(e) => set('telefone', e.target.value)} placeholder="(51) 9..." />
          </label>

          <label className="field"><span>Perfil</span>
            <select value={f.perfil} onChange={(e) => set('perfil', e.target.value)}>
              <option value="vendedor">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </label>

          <label className="field"><span>Nova senha</span>
            <input
              type="password"
              value={f.senha}
              minLength={8}
              onChange={(e) => set('senha', e.target.value)}
              placeholder="Deixe vazio para manter a atual"
            />
          </label>

          <div className="formFoot">
            <button type="button" className="btn-sair" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
  const [editandoCerveja, setEditandoCerveja] = useState(null);

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
          <div className="tabela-head">
            <span>Rótulo</span><span>Estilo</span><span>ABV</span><span>IBU</span>
            <span>Ativo</span><span></span>
          </div>
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
              <span data-label="">
                {ehAdmin && (
                  <button className="editar" onClick={() => setEditandoCerveja(c)}>Editar</button>
                )}
              </span>
            </div>
          ))}
        </div>

        {editandoCerveja && (
          <EditarCerveja
            cerveja={editandoCerveja}
            onFechar={() => setEditandoCerveja(null)}
            onSalvo={() => {
              setEditandoCerveja(null);
              setOk('Cerveja atualizada. Vale para a cotação e para os novos pedidos.');
              carregar();
            }}
          />
        )}

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

function EditarCerveja({ cerveja, onFechar, onSalvo }) {
  const [f, setF] = useState({
    nome: cerveja.nome || '',
    estilo: cerveja.estilo || '',
    abv: cerveja.abv ?? '',
    ibu: cerveja.ibu ?? '',
    preco_litro: cerveja.preco_litro ?? '',
    ordem: cerveja.ordem ?? 99,
  });
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const aoTeclar = (e) => e.key === 'Escape' && onFechar();
    window.addEventListener('keydown', aoTeclar);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = '';
    };
  }, [onFechar]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      await atualizarCerveja(cerveja.id, {
        nome: f.nome,
        estilo: f.estilo,
        abv: f.abv === '' ? null : Number(f.abv),
        ibu: f.ibu === '' ? null : Number(f.ibu),
        preco_litro: f.preco_litro === '' ? null : Number(f.preco_litro),
        ordem: Number(f.ordem) || 99,
      });
      onSalvo();
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modalFundo" onClick={onFechar}>
      <div className="modalCaixa estreita" onClick={(e) => e.stopPropagation()}>
        <div className="modalTopo">
          <div>
            <h2>Editar cerveja</h2>
            <p className="hint" style={{ margin: 0 }}>{cerveja.nome}</p>
          </div>
          <button className="modalFechar" onClick={onFechar} title="Fechar">✕</button>
        </div>

        <form className="form" onSubmit={salvar}>
          {erro && <div className="error">{erro}</div>}

          <label className="field"><span>Rótulo</span>
            <input value={f.nome} onChange={(e) => set('nome', e.target.value)} required />
          </label>

          <label className="field"><span>Estilo</span>
            <input value={f.estilo} onChange={(e) => set('estilo', e.target.value)} placeholder="Pilsen, Session IPA..." />
          </label>

          <div className="grid-form">
            <label className="field"><span>ABV %</span>
              <input type="number" step="0.1" value={f.abv} onChange={(e) => set('abv', e.target.value)} />
            </label>
            <label className="field"><span>IBU</span>
              <input type="number" value={f.ibu} onChange={(e) => set('ibu', e.target.value)} />
            </label>
            <label className="field"><span>R$ / litro</span>
              <input type="number" step="0.01" min="0" value={f.preco_litro}
                onChange={(e) => set('preco_litro', e.target.value)} />
            </label>
          </div>

          <label className="field"><span>Posição na lista</span>
            <input type="number" min="1" value={f.ordem} onChange={(e) => set('ordem', e.target.value)} />
          </label>
          <p className="hint" style={{ marginTop: '-8px' }}>
            Menor número aparece primeiro, na cotação e no pedido. Use 1 para a mais vendida.
            Quem tiver o mesmo número fica em ordem alfabética.
          </p>

          <div className="formFoot">
            <button type="button" className="btn-sair" onClick={onFechar}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
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
