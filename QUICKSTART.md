# ⚡ Quick Start (5 minutos)

## 1️⃣ Clonar / Abrir projeto

```bash
cd agenda-chopp
```

## 2️⃣ Backend (escolha uma)

### Opção A: Modo Demo (sem PostgreSQL)
```bash
npm install
npm run dev:demo
# http://localhost:3000/health
```

### Opção B: Com Docker Compose
```bash
docker-compose up
# Aguarde PostgreSQL + backend
```

## 3️⃣ Frontend

```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

## 4️⃣ Testar

**Admin Mode:**
- Agenda com 3 pedidos
- Abas: Agenda, Pendentes, Disponibilidade, Novo Pedido

**Cliente Mode:**
- Link público de agendamento
- Preencha: nome, telefone, data, cerveja, chopeira
- Clique "Enviar solicitação"

---

## 🎯 Endpoints para Testar

### CLI / Postman
```bash
# Health check
curl http://localhost:3000/health

# Listar pedidos
curl http://localhost:3000/api/pedidos

# Listar chopeiras
curl http://localhost:3000/api/recursos/chopeiras

# Listar cervejas
curl http://localhost:3000/api/recursos/cervejas

# Criar pedido (cliente)
curl -X POST http://localhost:3000/api/publico/agendar \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Maria Silva",
    "telefone": "(51) 99999-9999",
    "data_entrega": "2026-09-10",
    "gas": true,
    "valor_entrega_coleta": 100,
    "itens": [{"cerveja": "Predileta", "litros": 50, "valor_litro": 22}],
    "chopeiras": ["E.40L.1V.1"]
  }'
```

---

## 📁 Arquivos Importantes

| Arquivo | O que é |
|---------|---------|
| `src/index.js` | Backend principal |
| `src/index-dev.js` | Backend sem PostgreSQL |
| `frontend/src/App.jsx` | Frontend principal |
| `SETUP.md` | Setup local completo |
| `DEPLOY.md` | Deploy Railroad + Vercel |
| `PROJECT.md` | Documentação completa |

---

## ⚡ Se algo quebrar

```bash
# Limpar cache
rm -rf node_modules frontend/node_modules
npm install && cd frontend && npm install

# Resetar Docker
docker-compose down -v
docker-compose up --build

# Usar modo demo (sem DB)
npm run dev:demo
```

---

## 🚀 Deploy (1 clique)

Ver **DEPLOY.md** para instruções do Railway + Vercel

```bash
# Resumo:
git push origin main  # Railway auto-deploy
cd frontend && vercel --prod  # Frontend Vercel
```

---

**Pronto para usar! 🎉**
