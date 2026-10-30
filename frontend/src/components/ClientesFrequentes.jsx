import { useState, useEffect } from 'react';
import {
  getClientesFrequentes,
  criarClienteFrequente,
  atualizarClienteFrequente,
  novoLinkClienteFrequente,
} from '../services/api';

const linkDe = (token) => `${window.location.origin}/cotacao?c=${token}`;

async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = document.createElement('textarea');
    t.value = texto;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
  }
}

export default function ClientesFrequentes() {
  const [aberto, setAberto] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [novo, setNovo] = useState({ nome: '', telefone: '', endereco: '' });
  const [copiado, setCopiado] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (aberto) carregar();
  }, [aberto]);

  async function carregar() {
    try { setClientes(await getClientesFrequentes()); } catch (e) { setErro(e.message); }
  }

  async function adicionar(e) {
    e.preventDefault();
    setErro(null);
    try {
      await criarClienteFrequente(novo);
      setNovo({ nome: '', telefone: '', endereco: '' });
      carregar();
    } catch (e2) { setErro(e2.message); }
  }

  async function copiar(c) {
    await copiarTexto(linkDe(c.token));
    setCopiado(c.id);
    setTimeout(() => setCopiado(null), 2000);
  }

  async function trocarLink(c) {
    if (!confirm(`Gerar um link novo para ${c.nome}? O link antigo deixa de funcionar.`)) return;
    try { await novoLinkClienteFrequente(c.id); carregar(); } catch (e) { setErro(e.message); }
  }

  async function alternar(c) {
    try { await atualizarClienteFrequente(c.id, { ativo: !c.ativo }); carregar(); } catch (e) { setErro(e.message); }
  }

  return (
    <div className="linkCotacao" style={{ display: 'block' }}>
      <button type="button" className="linkBtn" onClick={() => setAberto(!aberto)}>
        {aberto ? 'Fechar clientes frequentes' : 'Clientes frequentes (link com dados já preenchidos)'}
      </button>

      {aberto && (
        <div style={{ marginTop: '14px' }}>
          <p className="hint">
            Cadastre quem pede sempre. Cada um ganha um link próprio: ao abrir, o formulário de
            cotação já vem com nome, telefone e endereço. Só quem tem o link vê esses dados.
          </p>
          {erro && <div className="error">{erro}</div>}

          {clientes.map((c) => (
            <div key={c.id} className="linkCotacao" style={{ opacity: c.ativo ? 1 : 0.5 }}>
              <span className="linkCotacaoLabel">
                {c.nome} · {c.telefone}
              </span>
              <button type="button" className="btn-primary" onClick={() => copiar(c)}>
                {copiado === c.id ? 'Copiado!' : 'Copiar link'}
              </button>
              <button type="button" className="linkBtn" onClick={() => trocarLink(c)}>Novo link</button>
              <button type="button" className="linkBtn" onClick={() => alternar(c)}>
                {c.ativo ? 'Desativar' : 'Reativar'}
              </button>
            </div>
          ))}

          <form className="grid-form" onSubmit={adicionar}>
            <label className="field"><span>Nome</span>
              <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} required />
            </label>
            <label className="field"><span>WhatsApp</span>
              <input value={novo.telefone} onChange={(e) => setNovo({ ...novo, telefone: e.target.value })} required />
            </label>
            <label className="field"><span>Endereço</span>
              <input value={novo.endereco} onChange={(e) => setNovo({ ...novo, endereco: e.target.value })} />
            </label>
            <div style={{ alignSelf: 'end', marginBottom: '14px' }}>
              <button type="submit" className="btn-primary">Cadastrar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
