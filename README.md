# Agenda de Chopp — Fora da Lei

Sistema de agendamento de entrega de chopp e chopeiras da Cervejaria Fora da Lei (Porto Alegre/RS).

## Stack

- **Backend:** Node.js + Express
- **Banco de dados:** PostgreSQL
- **Frontend:** React (protótipo em agendamento-chopp.jsx)
- **Notificações:** Google Calendar API
- **Hospedagem:** Railway (recomendado)

## Setup Local

### Pré-requisitos

- Node.js 18+
- PostgreSQL 12+
- Credenciais do Google Calendar API (opcional para dev)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Editar `.env` com:
- `DATABASE_URL`: string de conexão PostgreSQL
- `GOOGLE_CLIENT_EMAIL` e `GOOGLE_PRIVATE_KEY`: credenciais da Google Calendar API (opcional)

### 3. Criar banco de dados

```bash
createdb agenda_chopp
```

### 4. Rodar migrations

```bash
npm run migrate
```

### 5. Seed dos dados iniciais (chopeiras e cervejas)

```bash
npm run seed
```

### 6. Iniciar servidor

```bash
npm run dev
```

Servidor rodará em `http://localhost:3000`

## API Endpoints

### Pedidos

- `GET /api/pedidos` — Listar pedidos (filtros: status, data_inicio, data_fim)
- `GET /api/pedidos/:id` — Buscar pedido específico
- `POST /api/pedidos` — Criar novo pedido
- `PATCH /api/pedidos/:id` — Atualizar pedido
- `POST /api/pedidos/:id/confirmar` — Confirmar pedido (cria evento no Google Calendar)
- `DELETE /api/pedidos/:id` — Deletar pedido

### Recursos

- `GET /api/recursos/chopeiras` — Listar todas as chopeiras
- `GET /api/recursos/chopeiras/disponibles?data=2026-08-22` — Chopeiras disponíveis por data
- `GET /api/recursos/cervejas` — Listar todas as cervejas

## Exemplo de Request

### Criar novo pedido

```bash
curl -X POST http://localhost:3000/api/pedidos \
  -H "Content-Type: application/json" \
  -d '{
    "cliente": "Casamento da Ana",
    "telefone": "(51) 99123-4567",
    "data_entrega": "2026-08-22",
    "gas": true,
    "valor_entrega_coleta": 150,
    "pago": false,
    "resp_entrega": "Giba",
    "resp_coleta": "Eduardo",
    "status": "pendente",
    "origem": "interno",
    "itens": [
      {
        "cerveja": "Predileta",
        "litros": 100,
        "valor_litro": 22
      },
      {
        "cerveja": "Aloha",
        "litros": 40,
        "valor_litro": 30
      }
    ],
    "chopeiras": ["E.110L.2V.1"]
  }'
```

### Confirmar pedido

```bash
curl -X POST http://localhost:3000/api/pedidos/1/confirmar
```

## Próximas fases

1. ✅ Backend + PostgreSQL + CRUD
2. Frontend React (portar do protótipo)
3. Lógica de disponibilidade e validação
4. Integração completa Google Calendar
5. Link público de auto-agendamento
6. Deploy no Railway

## Notas

- Lembretes são notificações do Google Agenda (sem custo de WhatsApp)
- Total do pedido = Σ(litros × valor_litro) + valor_entrega_coleta
- Capacidade por vias é um **aviso**, não bloqueio
- Pedidos nascem como `pendente` até confirmação interna
