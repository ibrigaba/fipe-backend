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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function buscarModelos() {
  console.log('🚗 ETAPA 2: Buscando todos os modelos');
  
  try {
    // Pegar referência do banco
    const result = db.exec('SELECT code FROM referencias ORDER BY updated_at DESC LIMIT 1');
    if (!result[0]) {
      console.error('❌ Execute o script 1 primeiro!');
      return;
    }
    const refCode = result[0].values[0][0];

    // Pegar todas as marcas
    const marcasResult = db.exec('SELECT code, name, tipo_veiculo FROM marcas');
    if (!marcasResult[0]) {
      console.error('❌ Nenhuma marca encontrada!');
      return;
    }

    const marcas = marcasResult[0].values.map(row => ({
      code: row[0],
      name: row[1],
      tipo: row[2]
    }));

    console.log(`📦 ${marcas.length} marcas para processar\n`);

    let totalModelos = 0;
    let requisicoes = 0;

    for (let i = 0; i < marcas.length; i++) {
      const marca = marcas[i];
      console.log(`[${i + 1}/${marcas.length}] ${marca.name} (${marca.tipo})...`);

      try {
        const { data: modelos } = await axios.get(
          `${API_BASE}/${marca.tipo}/brands/${marca.code}/models?reference=${refCode}`,
          { headers: getHeaders() }
        );

        for (const modelo of modelos) {
          db.run(
            'INSERT OR REPLACE INTO modelos (code, marca_code, name, tipo_veiculo) VALUES (?, ?, ?, ?)',
            [modelo.code, marca.code, modelo.name, marca.tipo]
          );
          totalModelos++;
        }

        console.log(`   ✓ ${modelos.length} modelos salvos`);
        requisicoes++;

        // Salvar a cada 10 marcas
        if (i % 10 === 0) {
          saveDatabase();
        }

        // Delay para respeitar a API
        await delay(250);

      } catch (err) {
        console.error(`   ✗ Erro: ${err.message}`);
      }
    }

    saveDatabase();
    
    console.log(`\n✅ CONCLUÍDO: ${totalModelos} modelos salvos`);
    console.log(`📊 Requisições usadas: ${requisicoes}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

buscarModelos();