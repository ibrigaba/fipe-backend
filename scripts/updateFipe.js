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
  
  if (TOKEN) {
    headers['X-Subscription-Token'] = TOKEN;
  }
  
  return headers;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function atualizarFipe(tipoVeiculo = 'cars') {
  console.log(`🔄 Iniciando atualização: ${tipoVeiculo}`);
  
  try {
    const { data: referencias } = await axios.get(`${API_BASE}/references`, {
      headers: getHeaders()
    });
    
    const referenciaAtual = referencias[0];
    console.log(`📅 Referência: ${referenciaAtual.month} (${referenciaAtual.code})`);

    db.run(
      'INSERT OR REPLACE INTO referencias (code, month) VALUES (?, ?)',
      [referenciaAtual.code, referenciaAtual.month]
    );
    saveDatabase();

    const { data: marcas } = await axios.get(
      `${API_BASE}/${tipoVeiculo}/brands?reference=${referenciaAtual.code}`,
      { headers: getHeaders() }
    );
    
    console.log(`📦 ${marcas.length} marcas encontradas`);

    let totalVeiculos = 0;
    const MARCAS_LIMITE = 10;
    const MODELOS_LIMITE = 999;
    const ANOS_LIMITE = 999;

    for (const marca of marcas.slice(0, MARCAS_LIMITE)) {
      console.log(`  🔹 Processando marca: ${marca.name}`);
      
      db.run(
        'INSERT OR REPLACE INTO marcas (code, name, tipo_veiculo) VALUES (?, ?, ?)',
        [marca.code, marca.name, tipoVeiculo]
      );
      saveDatabase();
      await delay(200);

      try {
        const { data: modelos } = await axios.get(
          `${API_BASE}/${tipoVeiculo}/brands/${marca.code}/models?reference=${referenciaAtual.code}`,
          { headers: getHeaders() }
        );

        for (const modelo of modelos.slice(0, MODELOS_LIMITE)) {
          console.log(`    ⚫ Modelo: ${modelo.name}`);
          
          db.run(
            'INSERT OR REPLACE INTO modelos (code, marca_code, name, tipo_veiculo) VALUES (?, ?, ?, ?)',
            [modelo.code, marca.code, modelo.name, tipoVeiculo]
          );
          saveDatabase();
          await delay(200);

          try {
            const { data: anos } = await axios.get(
              `${API_BASE}/${tipoVeiculo}/brands/${marca.code}/models/${modelo.code}/years?reference=${referenciaAtual.code}`,
              { headers: getHeaders() }
            );

            for (const ano of anos.slice(0, ANOS_LIMITE)) {
              await delay(200);

              try {
                const { data: veiculo } = await axios.get(
                  `${API_BASE}/${tipoVeiculo}/brands/${marca.code}/models/${modelo.code}/years/${ano.code}?reference=${referenciaAtual.code}`,
                  { headers: getHeaders() }
                );

                db.run(
                  `INSERT OR REPLACE INTO veiculos 
                  (vehicle_type, brand, model, model_year, fuel, fuel_acronym, 
                   code_fipe, price, reference_month, marca_code, modelo_code, year_id)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                  [
                    veiculo.vehicleType, veiculo.brand, veiculo.model,
                    veiculo.modelYear, veiculo.fuel, veiculo.fuelAcronym,
                    veiculo.codeFipe, veiculo.price, veiculo.referenceMonth,
                    marca.code, modelo.code, ano.code
                  ]
                );

                totalVeiculos++;
                console.log(`      ✓ ${veiculo.modelYear} - ${veiculo.price}`);

              } catch (err) {
                console.error(`      ✗ Erro ano ${ano.code}:`, err.message);
              }
            }
            saveDatabase();
          } catch (err) {
            console.error(`    ✗ Erro anos do modelo ${modelo.code}:`, err.message);
          }
        }
      } catch (err) {
        console.error(`  ✗ Erro modelos da marca ${marca.code}:`, err.message);
      }
    }

    db.run(
      'INSERT INTO atualizacoes (tipo_veiculo, registros_atualizados, status) VALUES (?, ?, ?)',
      [tipoVeiculo, totalVeiculos, 'sucesso']
    );
    saveDatabase();

    console.log(`\n✅ Atualização concluída: ${totalVeiculos} veículos salvos`);

  } catch (error) {
    console.error('❌ Erro na atualização:', error.message);
    
    db.run(
      'INSERT INTO atualizacoes (tipo_veiculo, registros_atualizados, status) VALUES (?, ?, ?)',
      [tipoVeiculo, 0, `erro: ${error.message}`]
    );
    saveDatabase();
  }
}

atualizarFipe('cars');