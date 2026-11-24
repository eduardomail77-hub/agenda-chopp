// Login único vindo do Ferramentas Fora da Lei (ferramentas.foradalei.com.br).
// Copie este arquivo para o app. Ele só CONFERE passes: a chave abaixo é pública
// e não serve para criar passe nenhum (quem assina é só o Ferramentas).
//
// Uso:
//   const { conferirPasse } = require('./sso-passe');
//   const quem = conferirPasse(req.query.passe, 'fideliza');   // null se inválido
//   quem.sub -> 'eduardo' ou 'gilberto'
//
// Regras: assinatura Ed25519 válida, feito para ESTE app (aud), dentro de 60s,
// e usado uma vez só (o mesmo passe de novo é recusado).
const crypto = require('crypto');

const CHAVE_PUBLICA = 'MCowBQYDK2VwAyEA3VNKy9kcykYuK9PRWwP7yyHG93pyb5yhXfuDklAwSnY=';
const chave = crypto.createPublicKey({ key: Buffer.from(process.env.SSO_PUBLIC_KEY || CHAVE_PUBLICA, 'base64'), format: 'der', type: 'spki' });
const usados = new Map();

function conferirPasse(passe, app) {
  try {
    const [corpo, sig] = String(passe || '').split('.');
    if (!corpo || !sig) return null;
    if (!crypto.verify(null, Buffer.from(corpo), chave, Buffer.from(sig, 'base64url'))) return null;
    const d = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    const agora = Date.now();
    if (d.aud !== app || !(d.exp > agora) || d.exp > agora + 120000 || !d.jti) return null;
    for (const [j, ate] of usados) if (ate < agora) usados.delete(j);
    if (usados.has(d.jti)) return null;
    usados.set(d.jti, d.exp);
    if (d.sub !== 'eduardo' && d.sub !== 'gilberto') return null;
    return { sub: d.sub, nome: d.nome };
  } catch { return null; }
}

// Página que leva ao destino depois do login. Redireciona pelo navegador (e não
// com 302) para os cookies SameSite=Strict valerem já na primeira tela.
function paginaIr(destino) {
  const d = JSON.stringify(String(destino));
  return `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Entrando...</title>`
    + `<body style="background:#120f0d;color:#a89a8e;font-family:system-ui;display:grid;place-items:center;min-height:100vh">Entrando...`
    + `<script>location.replace(${d})</script></body>`;
}

module.exports = { conferirPasse, paginaIr };
