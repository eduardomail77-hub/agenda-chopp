import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CotacaoPublica from './components/CotacaoPublica';
import { loginSso } from './services/api';
import './index.css';

// /sso?passe=...: login único vindo do Ferramentas Fora da Lei. Entra e vai pra tela inicial.
if (window.location.pathname.replace(/\/$/, '') === '/sso') {
  const passe = new URLSearchParams(window.location.search).get('passe');
  history.replaceState(null, '', '/');
  if (passe) loginSso(passe).catch(() => {}).finally(() => window.location.replace('/'));
}

// /cotacao é a única página aberta ao público: nenhum dado da operação
// e nenhum pedaço do sistema interno é carregado nela.
const ehCotacaoPublica = window.location.pathname.replace(/\/$/, '') === '/cotacao';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{ehCotacaoPublica ? <CotacaoPublica /> : <App />}</React.StrictMode>
);
