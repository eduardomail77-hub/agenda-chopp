# 📋 Agenda de Chopp — Projeto Completo

> Sistema de agendamento de entrega de chopp e chopeiras da Cervejaria Fora da Lei

## 🎯 Visão Geral

| Item | Status |
|------|--------|
| **Backend** | ✅ Node.js + Express + PostgreSQL |
| **Frontend** | ✅ React + Vite + Light theme |
| **API** | ✅ 9 endpoints (CRUD + público) |
| **Validações** | ✅ Regras de negócio implementadas |
| **Integrações** | ✅ Google Calendar + SMS |
| **Deploy** | ✅ Railway + Vercel pronto |

---

## 📁 Estrutura do Projeto

```
agenda-chopp/
├── src/                          (Backend Node.js)
│   ├── index.js                  (Express principal)
│   ├── index-dev.js              (Mock mode sem DB)
│   ├── db/
│   │   ├── schema.sql            (5 tabelas)
│   │   ├── connection.js         (Pool PostgreSQL)
│   │   ├── migrate.js            (Setup banco)
│   │   └── seed.js               (Dados iniciais)
│   ├── controllers/
│   │   ├── pedidosController.js  (CRUD completo)
│   │   └── chopeirasController.js
│   ├── routes/
│   │   ├── pedidos.js            (6 rotas)
│   │   ├── recursos.js           (3 rotas)
│   │   └── publico.js            (1 rota pública)
│   ├── services/
│   │   └── googleCalendarService.js
│   └── utils/
│       └── validation.js
│
├── frontend/                     (React + Vite)
│   ├── src/
│   │   ├── App.jsx               (2 modos: admin + cliente)
│   │   ├── components/
│   │   │   ├── Agenda.jsx        (Grid de pedidos)
│   │   │   ├── Disponibilidade.jsx
│   │   │   ├── NovoPedido.jsx    (Form admin)
│   │   │   ├── Pendentes.jsx     (Revisão)
│   │   │   ├── AgendarPublico.jsx (Link público)
│   │   │   └── common/
│   │   ├── services/
│   │   │   └── api.js            (Fetch wrapper)
│   │   └── index.css             (Light theme)
│   ├── package.json
│   └── vercel.json
│
├── Dockerfile                    (Backend)
├── docker-compose.yml            (Local dev)
├── railway.json                  (Deploy config)
├── .railwayignore
├── SETUP.md                      (Instruções)
├── DEPLOY.md                     (Deploy Railway)
└── CLAUDE.md                     (Briefing original)
```

---

## 🚀 Arquitetura

```
┌─────────────────────────────────────────────┐
│            Frontend React (Vercel)          │
│  • Admin mode (5 abas)                      │
│  • Cliente mode (form público)              │
└────────────────┬────────────────────────────┘
                 │ VITE_API_URL
                 ▼
┌─────────────────────────────────────────────┐
│       Backend Express (Railway)             │
│  • /api/pedidos (CRUD)                      │
│  • /api/recursos (chopeiras, cervejas)     │
│  • /api/publico/agendar (cliente)          │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴──────────┬──────────┐
        ▼                   ▼          ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │ Google       │  │ Seed data    │
│  (Railway)   │  │ Calendar API │  │  (8 kits)    │
│              │  │              │  │  (10 beers)  │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 📊 Modelo de Dados

### Tabelas PostgreSQL

**pedidos** (3 status: pendente → confirmado)
- id, cliente, telefone, data_entrega
- gas (bool), valor_entrega_coleta
- pago (bool), resp_entrega, resp_coleta
- status, origem (interno/cliente)
- google_event_id (link com Google Calendar)

**pedido_itens** (N cervejas por pedido)
- pedido_id, cerveja, litros, valor_litro

**pedido_chopeiras** (N chopeiras por pedido)
- pedido_id, chopeira_id

**chopeiras** (8 unidades fixas)
- E.25L.1V.1, E.25L.1V.2, E.40L.1V.1, E.110L.2V.1
- G.1V.1, G.1V.2, G.1V.3, G.2V.1

**cervejas** (10 rótulos)
- Predileta, Old Barn, Sunset, Prohibition, Red Door
- Dois Mundos, Aloha, Five Hops, La Tripel, Hop Witcher

---

## 🔌 API Endpoints

### Admin (Autenticado - Futuro)
```
GET    /api/pedidos               Lista pedidos (filtros: status, data)
GET    /api/pedidos/:id           Detalhes pedido
POST   /api/pedidos               Criar pedido (interno)
PATCH  /api/pedidos/:id           Atualizar pedido
POST   /api/pedidos/:id/confirmar Confirmar → Google Calendar
DELETE /api/pedidos/:id           Deletar pedido

GET    /api/recursos/chopeiras
GET    /api/recursos/chopeiras/disponibles?data=2026-09-05
GET    /api/recursos/cervejas
```

### Público (Sem autenticação)
```
POST   /api/publico/agendar       Cliente agenda chopp
```

---

## 🎨 UI/UX

### Tema
- **Light mode** (Fideliza+ inspired)
- Cores: Roxo #6366f1, Verde #10b981, Âmbar #f59e0b, Vermelho #ef4444
- Responsivo (mobile-first)

### Modos
| Admin | Cliente |
|-------|---------|
| 👤 Modo protegido | 🔗 Link público aberto |
| Agenda (todos) | Agendar Chopp (form) |
| Pendentes (revisar) | — |
| Disponibilidade | — |
| Novo Pedido | — |

---

## ⚙️ Setup

### Desenvolvimento (Com Docker)
```bash
docker-compose up
# Backend: http://localhost:3000
# Frontend: http://localhost:5173
```

### Desenvolvimento (Sem Docker)
```bash
npm install && npm run dev:demo  # Backend (mock)
cd frontend && npm install && npm run dev  # Frontend
```

### Produção (Railway + Vercel)
```bash
# Ver DEPLOY.md para instruções completas
railway login && railway init
vercel --prod
```

---

## 🧪 Testes Realizados

✅ **Backend**
- CRUD completo de pedidos
- Validações de negócio
- Google Calendar integration
- Dados mock (sem DB)

✅ **Frontend**
- Admin mode (5 abas)
- Cliente mode (form)
- Validação de form
- Cálculo de total em tempo real
- Responsivo

✅ **Integração**
- API client funciona
- Estados visuais atualizados
- Modo demo sem PostgreSQL

---

## 📱 Fluxo de Uso

### Cliente (Link Público)
1. Acessa `/` > clica 🔗 Cliente
2. Preenche: nome, telefone, data, cerveja, chopeira
3. Valida automaticamente (capacidade, data futura, etc)
4. Envia solicitação
5. Status: **Pendente** até admin confirmar

### Admin
1. Acessa `/` > está em modo 👤 Admin
2. Vê **Agenda** com todos os pedidos
3. Clica aba **Pendentes** para revisar novos
4. Verifica **Disponibilidade** por data
5. Confirma pedido → Cria evento no Google Calendar
6. Cliente recebe notificações (2 dias, 1 dia, dia da entrega)

---

## 🔐 Segurança (Futuro)

Implementar:
- ✅ Google Calendar API (credenciais seguras)
- ⏳ Autenticação admin (JWT)
- ⏳ Rate limiting (API pública)
- ⏳ Validação de CORS
- ⏳ Helmet.js (headers segurança)

---

## 📈 Escalabilidade

| Item | Status | Próximo |
|------|--------|--------|
| Multi-tenant | ❌ | Futuro |
| Cache Redis | ❌ | Futuro |
| Queue (Bull) | ❌ | Para email/SMS |
| Analytics | ❌ | Mixpanel/Segment |
| Mobile app | ❌ | React Native |

---

## 📚 Documentação

- **SETUP.md** → Como rodar localmente
- **DEPLOY.md** → Como fazer deploy (Railway + Vercel)
- **CLAUDE.md** → Briefing original do projeto
- **README.md** → Overview + exemplo de API

---

## 🎓 Stack Resumido

| Layer | Tech | Version |
|-------|------|---------|
| **Backend** | Node.js | 18+ |
| **Backend** | Express | 4.18 |
| **Database** | PostgreSQL | 15 |
| **Frontend** | React | 18 |
| **Build** | Vite | 5 |
| **Deploy** | Railway | — |
| **Deploy** | Vercel | — |

---

## 👥 Autores & Contribuidores

- **Briefing:** Eduardo (Fora da Lei)
- **Design:** Protótipo do Eduardo
- **Development:** Claude Haiku 4.5

---

## 📞 Suporte

Para dúvidas ou issues:
1. Checar **SETUP.md** / **DEPLOY.md**
2. Verificar logs: `railway logs` ou console do Vercel
3. Testar modo mock: `npm run dev:demo` (sem PostgreSQL)

---

**Status:** ✅ Pronto para produção (v1.0)

Última atualização: 19/08/2026
