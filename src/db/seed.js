import { query, close } from './connection.js';

const CHOPEIRAS = [
  { id: 'E.25L.1V.1', tipo: 'Elétrica', vias: 1, vazao: 25 },
  { id: 'E.25L.1V.2', tipo: 'Elétrica', vias: 1, vazao: 25 },
  { id: 'E.40L.1V.1', tipo: 'Elétrica', vias: 1, vazao: 40 },
  { id: 'E.110L.2V.1', tipo: 'Elétrica', vias: 2, vazao: 110 },
  { id: 'G.1V.1', tipo: 'Gelo', vias: 1, vazao: null },
  { id: 'G.1V.2', tipo: 'Gelo', vias: 1, vazao: null },
  { id: 'G.1V.3', tipo: 'Gelo', vias: 1, vazao: null },
  { id: 'G.2V.1', tipo: 'Gelo', vias: 2, vazao: null },
];

const CERVEJAS = [
  { nome: 'Predileta', estilo: 'Cream Ale', abv: 4.5, ibu: 10 },
  { nome: 'Old Barn', estilo: 'Weissbier', abv: 5.5, ibu: 15 },
  { nome: 'Sunset', estilo: 'Session IPA', abv: 4.2, ibu: 37 },
  { nome: 'Prohibition', estilo: 'Brown Ale', abv: 4.7, ibu: 23 },
  { nome: 'Red Door', estilo: 'Irish Red Ale', abv: 6.6, ibu: 31 },
  { nome: 'Dois Mundos', estilo: 'American Pale Ale', abv: 5.5, ibu: 35 },
  { nome: 'Aloha', estilo: 'Juicy IPA', abv: 6.1, ibu: 50 },
  { nome: 'Five Hops', estilo: 'American IPA', abv: 6.6, ibu: 55 },
  { nome: 'La Tripel', estilo: 'Belgian Tripel', abv: 7.9, ibu: 17 },
  { nome: 'Hop Witcher', estilo: 'Double IPA', abv: 9, ibu: 90 },
];

async function seed() {
  try {
    console.log('Iniciando seed do banco de dados...');

    // Limpar dados existentes
    await query('TRUNCATE TABLE pedido_chopeiras CASCADE');
    await query('TRUNCATE TABLE pedido_itens CASCADE');
    await query('TRUNCATE TABLE pedidos CASCADE');
    await query('TRUNCATE TABLE chopeiras CASCADE');
    await query('TRUNCATE TABLE cervejas CASCADE');

    // Inserir chopeiras
    for (const chopeira of CHOPEIRAS) {
      await query(
        'INSERT INTO chopeiras (id, tipo, vias, vazao) VALUES ($1, $2, $3, $4)',
        [chopeira.id, chopeira.tipo, chopeira.vias, chopeira.vazao]
      );
    }
    console.log(`✓ ${CHOPEIRAS.length} chopeiras inseridas`);

    // Inserir cervejas
    for (const cerveja of CERVEJAS) {
      await query(
        'INSERT INTO cervejas (nome, estilo, abv, ibu) VALUES ($1, $2, $3, $4)',
        [cerveja.nome, cerveja.estilo, cerveja.abv, cerveja.ibu]
      );
    }
    console.log(`✓ ${CERVEJAS.length} cervejas inseridas`);

    console.log('✓ Seed concluído com sucesso!');
    await close();
  } catch (err) {
    console.error('✗ Erro no seed:', err);
    await close();
    process.exit(1);
  }
}

seed();
