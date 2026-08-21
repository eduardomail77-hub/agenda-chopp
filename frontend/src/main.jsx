import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import CotacaoPublica from './components/CotacaoPublica';
import './index.css';

// /cotacao é a única página aberta ao público: nenhum dado da operação
// e nenhum pedaço do sistema interno é carregado nela.
const ehCotacaoPublica = window.location.pathname.replace(/\/$/, '') === '/cotacao';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{ehCotacaoPublica ? <CotacaoPublica /> : <App />}</React.StrictMode>
);
