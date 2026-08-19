# 🛠️ Setup Agenda de Chopp

## Local (Desenvolvimento)

### Opção 1: Com Docker Compose (Recomendado)

```bash
# Inicia PostgreSQL + Backend + Frontend
docker-compose up

# Em novo terminal:
# Backend:  http://localhost:3000
# Frontend: http://localhost:5173
```

### Opção 2: Manual (Sem Docker)

**Backend:**
```bash
npm install
cp .env.example .env

# Editar .env com PostgreSQL local
npm run migrate
npm run seed
npm run dev  # ou npm run dev:demo para modo sem DB
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Railway (Produção)

### Pré-requisitos
- Conta Railway: https://railway.app
- Git + GitHub conectado

### Deploy Rápido

```bash
# 1. Push para GitHub
git add .
git commit -m "Deploy"
git push origin main

# 2. Railway dashboard
# - Conectar GitHub repo
# - Criar projeto
# - Adicionar PostgreSQL service
# - Deploy automático
```

### Variáveis de Ambiente Railway

No painel > Seu projeto > Variables:

```
NODE_ENV=production
GOOGLE_CLIENT_EMAIL=seu_email@projeto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
GOOGLE_CALENDAR_ID=seu_calendario@gmail.com
```

### Deploy Frontend (Vercel)

```bash
cd frontend
vercel --prod

# Configurar env var:
# VITE_API_URL = https://seu-projeto-production.up.railway.app/api
```

---

## Google Calendar API

### Setup (uma vez)

1. Ir para https://console.cloud.google.com
2. Criar novo projeto
3. Ativar **Google Calendar API**
4. Criar **Service Account**
5. Gerar chave JSON
6. Copiar `client_email` e `private_key`
7. Criar calendário no Gmail
8. Compartilhar calendário com `client_email`

### Testar Localmente

```bash
# Com .env preenchido:
npm run dev

# Ir para http://localhost:5173
# Admin mode > criar pedido > confirmar
# Deve criar evento no Google Calendar
```

---

## Checklist Final

### Backend
- [ ] PostgreSQL rodando
- [ ] `npm run migrate` executado
- [ ] `npm run seed` executado
- [ ] `npm run dev` ou `npm run dev:demo`
- [ ] `GET http://localhost:3000/health` retorna OK
- [ ] Google Calendar credenciais configuradas

### Frontend
- [ ] `npm install` executado
- [ ] `npm run dev` rodando
- [ ] `http://localhost:5173` acessível
- [ ] Admin mode + Cliente mode funcionam
- [ ] Formulário de agendamento validado

### Integração
- [ ] Backend + Frontend comunicam
- [ ] Criar pedido → API → banco dados
- [ ] Confirmar pedido → Google Calendar event
- [ ] Modo Cliente funciona

### Deploy
- [ ] Repo no GitHub (com `git push`)
- [ ] Railway conectado ao GitHub
- [ ] PostgreSQL railway criado
- [ ] Backend em produção
- [ ] Frontend em Vercel
- [ ] VITE_API_URL apontando correto

---

## Comandos Úteis

```bash
# Backend
npm run dev              # Modo desenvolvimento
npm run dev:demo        # Modo sem PostgreSQL
npm run migrate         # Rodar migrations
npm run seed            # Popular banco

# Frontend
cd frontend
npm run dev             # Dev server
npm run build           # Build para produção
npm run preview         # Preview build

# Docker
docker-compose up       # Inicia tudo
docker-compose down     # Para tudo
docker-compose logs -f  # Ver logs
```

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| PostgreSQL connection refused | `npm run dev:demo` para usar modo mock |
| VITE_API_URL undefined | Copiar `.env.example` → `.env` no frontend |
| Google Calendar não funciona | Verificar credenciais em `.env` |
| Port 3000/5173 em uso | `lsof -i :3000` e `kill -9 PID` |
| Migrations não rodaram | Executar `npm run migrate` manualmente |

---

## Próximos Passos

1. ✅ Setup local completo
2. ✅ Testar modo admin + cliente
3. ✅ Configurar Google Calendar
4. ✅ Push para GitHub
5. ✅ Deploy Railway + Vercel
6. 📱 Compartilhar link público com clientes
7. 📊 Monitorar pedidos em produção
