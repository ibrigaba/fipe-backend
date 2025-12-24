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

async function buscarDetalhes(limiteRequisicoes = 200) {
  console.log(`🚗 ETAPA 3: Buscando detalhes dos veículos`);
  console.log(`⚠️  Limite de requisições: ${limiteRequisicoes}\n`);
  
  try {
    // Pegar referência
    const result = db.exec('SELECT code FROM referencias ORDER BY updated_at DESC LIMIT 1');
    if (!result[0]) {
      console.error('❌ Execute o script 1 primeiro!');
      return;
    }
    const refCode = result[0].values[0][0];

    // Pegar modelos que ainda não têm veículos detalhados
    const modelosResult = db.exec(`
      SELECT DISTINCT m.code, m.marca_code, m.name, m.tipo_veiculo 
      FROM modelos m
      LEFT JOIN veiculos v ON v.modelo_code = m.code AND v.marca_code = m.marca_code
      WHERE v.id IS NULL
      LIMIT ${Math.floor(limiteRequisicoes / 3)}
    `);

    if (!modelosResult[0]) {
      console.log('✅ Todos os modelos já têm detalhes!');
      return;
    }

    const modelos = modelosResult[0].values.map(row => ({
      code: row[0],
      marca_code: row[1],
      name: row[2],
      tipo: row[3]
    }));

    console.log(`📦 ${modelos.length} modelos para processar\n`);

    let totalVeiculos = 0;
    let requisicoes = 0;

    for (let i = 0; i < modelos.length; i++) {
      const modelo = modelos[i];
      
      if (requisicoes >= limiteRequisicoes) {
        console.log(`\n⚠️  Limite de ${limiteRequisicoes} requisições atingido!`);
        break;
      }

      console.log(`[${i + 1}/${modelos.length}] ${modelo.name}...`);

      try {
        // Buscar anos disponíveis
        const { data: anos } = await axios.get(
          `${API_BASE}/${modelo.tipo}/brands/${modelo.marca_code}/models/${modelo.code}/years?reference=${refCode}`,
          { headers: getHeaders() }
        );
        requisicoes++;

        console.log(`   → ${anos.length} anos encontrados`);

        // Buscar detalhes de cada ano
        for (const ano of anos) {
          if (requisicoes >= limiteRequisicoes) break;

          await delay(250);

          try {
            const { data: veiculo } = await axios.get(
              `${API_BASE}/${modelo.tipo}/brands/${modelo.marca_code}/models/${modelo.code}/years/${ano.code}?reference=${refCode}`,
              { headers: getHeaders() }
            );
            requisicoes++;

            db.run(
              `INSERT OR REPLACE INTO veiculos 
              (vehicle_type, brand, model, model_year, fuel, fuel_acronym, 
               code_fipe, price, reference_month, marca_code, modelo_code, year_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                veiculo.vehicleType, veiculo.brand, veiculo.model,
                veiculo.modelYear, veiculo.fuel, veiculo.fuelAcronym,
                veiculo.codeFipe, veiculo.price, veiculo.referenceMonth,
                modelo.marca_code, modelo.code, ano.code
              ]
            );

            totalVeiculos++;

          } catch (err) {
            console.error(`      ✗ Erro ano ${ano.code}: ${err.message}`);
          }
        }

        console.log(`   ✓ Salvos`);

        // Salvar a cada 5 modelos
        if (i % 5 === 0) {
          saveDatabase();
        }

      } catch (err) {
        console.error(`   ✗ Erro: ${err.message}`);
      }
    }

    saveDatabase();
    
    db.run(
      'INSERT INTO atualizacoes (tipo_veiculo, registros_atualizados, status) VALUES (?, ?, ?)',
      ['detalhes', totalVeiculos, 'sucesso']
    );
    saveDatabase();

    console.log(`\n✅ CONCLUÍDO: ${totalVeiculos} veículos salvos`);
    console.log(`📊 Requisições usadas: ${requisicoes}`);
    console.log(`📊 Requisições restantes: ${limiteRequisicoes - requisicoes}`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Você pode ajustar o limite aqui
// Exemplo: buscarDetalhes(200) = usa 200 requisições
buscarDetalhes(200);