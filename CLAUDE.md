# Agenda de Chopp — Fora da Lei

Sistema de agendamento de entrega de chopp e chopeiras da Cervejaria Fora da Lei
(Porto Alegro/RS). Este arquivo é o contexto-base do projeto: leia antes de
qualquer implementação.

Há um protótipo de referência em React (`agendamento-chopp.jsx`) que já mostra o
fluxo, as telas e o modelo de dados esperado. Use-o como norte visual e funcional.

---

## Objetivo

Organizar, num só lugar compartilhado pela equipe:
1. A **agenda** de entregas de chopp.
2. A **disponibilidade** das chopeiras (e do chopp) por data.
3. **Quem entrega** e **quem recolhe** cada pedido.
4. **Lembretes automáticos** para os envolvidos (2 dias antes, 1 dia antes e no dia).

Requisito forte: os lembretes **não** podem sair por WhatsApp (evitar cobrança por
mensagem). Devem chegar como **notificação no celular** — a solução adotada é o
**Google Agenda** (ver seção Notificações).

---

## Stack recomendada

- **Backend:** Node.js + Express (mesma linha do chatbot Lupulina, já em produção).
- **Banco:** PostgreSQL.
- **Frontend:** React (portar do protótipo `agendamento-chopp.jsx`).
- **Hospedagem:** Railway (backend + Postgres gerenciado no mesmo lugar).
- **Notificações/agenda:** Google Calendar API.

---

## Modelo de dados

**pedidos**
- id
- cliente (texto)
- telefone (texto)
- data_entrega (date)
- gas (bool)
- valor_entrega_coleta (numeric) — taxa de entrega + recolhimento
- pago (bool)
- resp_entrega (texto/ref) — responsável pela entrega
- resp_coleta (texto/ref) — responsável pela coleta
- status: `pendente` | `confirmado`
- origem: `interno` (equipe cadastrou) | `cliente` (veio do link público)
- google_event_id (texto, nulo até confirmar)
- created_at

**pedido_itens** (um pedido tem 1..N cervejas)
- id
- pedido_id (fk)
- cerveja (nome/ref ao catálogo)
- litros (numeric)
- valor_litro (numeric) — preço por litro pode variar por rótulo

**pedido_chopeiras** (um pedido usa 1..N chopeiras)
- pedido_id (fk)
- chopeira_id (fk)

**chopeiras** (catálogo fixo — 8 unidades)
- id, tipo (`Elétrica`|`Gelo`), vias (int), vazao (int, L/h; nulo p/ gelo)

**cervejas** (catálogo)
- nome, estilo, abv, ibu

---

## Frota de chopeiras (catálogo fixo)

Nomenclatura oficial: `tipo.vazão(L).vias(V).sequência`.

| id            | tipo     | vazão  | vias |
|---------------|----------|--------|------|
| E.25L.1V.1    | Elétrica | 25 L/h | 1    |
| E.25L.1V.2    | Elétrica | 25 L/h | 1    |
| E.40L.1V.1    | Elétrica | 40 L/h | 1    |
| E.110L.2V.1   | Elétrica | 110 L/h| 2    |
| G.1V.1        | Gelo     | —      | 1    |
| G.1V.2        | Gelo     | —      | 1    |
| G.1V.3        | Gelo     | —      | 1    |
| G.2V.1        | Gelo     | —      | 2    |

Nas telas, destacar visualmente as chopeiras de **2 vias**.

---

## Catálogo de cervejas

| Rótulo       | Estilo             | ABV   | IBU |
|--------------|--------------------|-------|-----|
| Predileta    | Cream Ale          | 4,5%  | 10  |
| Old Barn     | Weissbier          | 5,5%  | 15  |
| Sunset       | Session IPA        | 4,2%  | 37  |
| Prohibition  | Brown Ale          | 4,7%  | 23  |
| Red Door     | Irish Red Ale      | 6,6%  | 31  |
| Dois Mundos  | American Pale Ale  | 5,5%  | 35  |
| Aloha        | Juicy IPA          | 6,1%  | 50  |
| Five Hops    | American IPA       | 6,6%  | 55  |
| La Tripel    | Belgian Tripel     | 7,9%  | 17  |
| Hop Witcher  | Double IPA         | 9%    | 90  |

---

## Regras de negócio

1. **Total do pedido** = Σ(litros × valor_litro de cada cerveja) + valor_entrega_coleta.
2. **Disponibilidade:** uma chopeira está ocupada numa data se pertence a algum
   pedido com aquela data_entrega. A tela de disponibilidade lista as 8 e mostra
   livres/ocupadas (e o cliente que ocupou).
3. **Capacidade por vias:** cada via serve 1 cerveja. 1 via = 1 rótulo;
   2 vias = até 2 rótulos ao mesmo tempo. O total de vias das chopeiras do pedido
   deve cobrir o nº de cervejas. Hoje é **aviso**, não bloqueio (equipe pode
   revezar rótulo numa via ao longo do evento).
4. **Fluxo pendente → confirmado:** todo pedido nasce `pendente`. Só ao
   **confirmar** é que ocupa a agenda de verdade e dispara a notificação. Isso dá
   ao dono o controle de conferir disponibilidade antes.

---

## Notificações (Google Agenda)

Ao **confirmar** um pedido, o backend cria um evento no Google Calendar via
Google Calendar API:
- Título/descrição com cliente, cervejas, litros, chopeiras, responsáveis.
- **Convidados:** responsável pela entrega e pela coleta (recebem notificação
  nativa e gratuita no celular — Android e iPhone).
- **Lembretes:** 2 dias antes, 1 dia antes e no dia.
- Guardar o `google_event_id` no pedido para atualizar/cancelar depois.

Sem WhatsApp em nenhum lembrete. O Google Agenda é a agenda compartilhada + o
motor de notificações, tudo sem custo por mensagem.

---

## Link público de auto-agendamento

- Rota pública (ex.: `/agendar`) com formulário para o **cliente** preencher o
  próprio pedido (ou para um funcionário preencher).
- Ao enviar, cria pedido `status=pendente`, `origem=cliente`.
- Dispara aviso ao dono (evento tentativo no Google Agenda e/ou e-mail) para
  conferir disponibilidade e confirmar.
- Nunca ocupa chopeira sem a confirmação interna.

---

## Fases de construção (sugestão)

1. ✅ Backend + Postgres + catálogos (chopeiras, cervejas) + CRUD de pedidos.
2. Frontend portado do protótipo (Agenda, Disponibilidade, Novo pedido).
3. Lógica de disponibilidade e regra de capacidade por vias.
4. Integração Google Calendar (criar/atualizar evento + lembretes na confirmação).
5. Link público de auto-agendamento + tela de pendentes para aprovar.
6. Deploy no Railway.
