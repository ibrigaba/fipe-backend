import axios from 'axios';
import db, { saveDatabase } from '../db/database.js';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'https://fipe.parallelum.com.br/api/v2';
const TOKEN = process.env.FIPE_TOKEN || '';

const getHeaders = () => {
  const headers = {
    'accept': 'application/json',
    'content-type': 'application/json'
  };
  if (TOKEN) headers['X-Subscription-Token'] = TOKEN;
  return headers;
};

async function buscarMarcas() {
  console.log('🚗 ETAPA 1: Buscando todas as marcas');
  
  try {
    // Buscar referência
    const { data: referencias } = await axios.get(`${API_BASE}/references`, {
      headers: getHeaders()
    });
    
    const ref = referencias[0];
    console.log(`📅 Referência: ${ref.month} (${ref.code})`);
    
    db.run('INSERT OR REPLACE INTO referencias (code, month) VALUES (?, ?)', [ref.code, ref.month]);
    saveDatabase();

    // Buscar marcas de carros
    const tipos = ['cars', 'motorcycles', 'trucks'];
    let totalMarcas = 0;

    for (const tipo of tipos) {
      console.log(`\n📦 Buscando marcas de ${tipo}...`);
      
      const { data: marcas } = await axios.get(
        `${API_BASE}/${tipo}/brands?reference=${ref.code}`,
        { headers: getHeaders() }
      );

      for (const marca of marcas) {
        db.run(
          'INSERT OR REPLACE INTO marcas (code, name, tipo_veiculo) VALUES (?, ?, ?)',
          [marca.code, marca.name, tipo]
        );
        totalMarcas++;
      }
      
      console.log(`   ✓ ${marcas.length} marcas de ${tipo} salvas`);
    }

    saveDatabase();
    
    console.log(`\n✅ CONCLUÍDO: ${totalMarcas} marcas salvas`);
    console.log(`📊 Requisições usadas: ~3 (1 por tipo de veículo)`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

buscarMarcas();