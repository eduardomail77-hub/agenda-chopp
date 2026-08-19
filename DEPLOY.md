# 🚀 Deploy Agenda de Chopp

## Railway (Backend + PostgreSQL)

### 1. Pré-requisitos
- Conta no [railway.app](https://railway.app)
- Git instalado

### 2. Deploy Backend + Database

```bash
# Login no Railway
railway login

# Criar novo projeto
railway init

# Adicionar PostgreSQL
railway add
# Escolher PostgreSQL

# Deploy
railway up
```

Railway automaticamente:
- ✅ Cria banco PostgreSQL gerenciado
- ✅ Expõe variável `DATABASE_URL`
- ✅ Deploy do Dockerfile
- ✅ Roda migrations automaticamente

### 3. Variáveis de Ambiente (Railway)

Após deploy, adicione no painel Railway:

```
NODE_ENV=production
GOOGLE_CLIENT_EMAIL=seu_cliente_google@exemplo.com
GOOGLE_PRIVATE_KEY=sua_chave_privada_google
GOOGLE_CALENDAR_ID=seu_calendar_id@google.com
```

**Para Google Calendar:**
1. Criar conta de serviço em [console.cloud.google.com](https://console.cloud.google.com)
2. Gerar chave JSON (private_key)
3. Ativar Google Calendar API
4. Compartilhar calendário com o email da conta de serviço

### 4. URL do Backend

Após deploy, Railway gera uma URL como:
```
https://agenda-chopp-production.railway.app
```

### 5. Deploy Frontend (Vercel)

```bash
cd frontend

# Login/Deploy
vercel --prod
```

Durante o deploy, configure a variável de ambiente:
```
VITE_API_URL=https://agenda-chopp-production.railway.app/api
```

---

## Alternativa: Git Push to Deploy

### 1. Conectar GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/seu-usuario/agenda-chopp.git
git push -u origin main
```

### 2. No painel Railway
- Conectar GitHub
- Selecionar repositório `agenda-chopp`
- Railway faz deploy automático a cada push

---

## Checklist de Deploy

- [ ] PostgreSQL criado no Railway
- [ ] Migrations rodaram (verificar logs)
- [ ] DATABASE_URL configurada
- [ ] Google Calendar API credenciais configuradas
- [ ] Backend respondendo em `/health`
- [ ] Frontend deployado no Vercel
- [ ] VITE_API_URL apontando para backend Railway
- [ ] Testar criar pedido (frontend → backend → Google Calendar)

---

## Troubleshooting

### "Connection refused" no backend
- Verificar `DATABASE_URL` está correta
- Rodar migrations manualmente: `npm run migrate`

### Google Calendar não cria eventos
- Verificar credenciais
- Verificar email da conta de serviço foi compartilhado com calendário

### Frontend não conecta ao backend
- Verificar VITE_API_URL em Vercel
- Testar CORS: frontend pode fazer requests para backend?

---

## Monitoramento

**Railway:**
- Logs em tempo real: `railway logs`
- Métricas: Painel web

**Vercel:**
- Analytics em dashboard.vercel.com
- Logs de build/deploy

---

## Rollback

```bash
# Voltar para versão anterior
railway rollback

# Ou fazer push com git
git revert HEAD
git push origin main
```
