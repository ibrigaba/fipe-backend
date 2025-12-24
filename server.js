import express from 'express';
import cron from 'node-cron';
import db, { saveDatabase } from './db/database.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/', (req, res) => {
  res.json({
    message: 'API Tabela FIPE - Backend',
    endpoints: {
      status: '/api/status',
      referencias: '/api/referencias',
      marcas: '/api/marcas/:tipo',
      modelos: '/api/modelos/:tipo/:marcaCode',
      veiculos: '/api/veiculos/:marcaCode/:modeloCode',
      buscarFipe: '/api/buscar/:codigoFipe'
    }
  });
});

app.get('/api/referencias', (req, res) => {
  const result = db.exec('SELECT * FROM referencias ORDER BY updated_at DESC');
  const referencias = result[0] ? result[0].values.map(row => ({
    code: row[0],
    month: row[1],
    updated_at: row[2]
  })) : [];
  
  res.json({ referencias });
});

app.get('/api/marcas/:tipo', (req, res) => {
  const { tipo } = req.params;
  
  const result = db.exec(
    'SELECT code, name FROM marcas WHERE tipo_veiculo = ? ORDER BY name',
    [tipo]
  );
  
  const marcas = result[0] ? result[0].values.map(row => ({
    code: row[0],
    name: row[1]
  })) : [];

  res.json({ marcas, total: marcas.length });
});

app.get('/api/modelos/:tipo/:marcaCode', (req, res) => {
  const { tipo, marcaCode } = req.params;
  
  const result = db.exec(
    'SELECT code, name FROM modelos WHERE marca_code = ? AND tipo_veiculo = ? ORDER BY name',
    [marcaCode, tipo]
  );
  
  const modelos = result[0] ? result[0].values.map(row => ({
    code: row[0],
    name: row[1]
  })) : [];

  res.json({ modelos, total: modelos.length });
});

app.get('/api/veiculos/:marcaCode/:modeloCode', (req, res) => {
  const { marcaCode, modeloCode } = req.params;
  
  const result = db.exec(
    'SELECT * FROM veiculos WHERE marca_code = ? AND modelo_code = ? ORDER BY model_year DESC',
    [marcaCode, modeloCode]
  );
  
  const veiculos = result[0] ? result[0].values.map(row => ({
    id: row[0],
    vehicle_type: row[1],
    brand: row[2],
    model: row[3],
    model_year: row[4],
    fuel: row[5],
    fuel_acronym: row[6],
    code_fipe: row[7],
    price: row[8],
    reference_month: row[9]
  })) : [];

  res.json({ veiculos, total: veiculos.length });
});

app.get('/api/buscar/:codigoFipe', (req, res) => {
  const { codigoFipe } = req.params;
  
  const result = db.exec(
    'SELECT * FROM veiculos WHERE code_fipe = ? ORDER BY model_year DESC',
    [codigoFipe]
  );
  
  if (!result[0]) {
    return res.status(404).json({ 
      error: 'Veículo não encontrado',
      codigoFipe 
    });
  }
  
  const veiculos = result[0].values.map(row => ({
    id: row[0],
    vehicle_type: row[1],
    brand: row[2],
    model: row[3],
    model_year: row[4],
    fuel: row[5],
    fuel_acronym: row[6],
    code_fipe: row[7],
    price: row[8],
    reference_month: row[9]
  }));

  res.json({ veiculos, total: veiculos.length });
});

app.get('/api/status', (req, res) => {
  const result1 = db.exec('SELECT * FROM atualizacoes ORDER BY data_atualizacao DESC LIMIT 10');
  const ultimasAtualizacoes = result1[0] ? result1[0].values.map(row => ({
    id: row[0],
    tipo_veiculo: row[1],
    data_atualizacao: row[2],
    registros_atualizados: row[3],
    status: row[4]
  })) : [];

  const result2 = db.exec(`
    SELECT 
      COUNT(DISTINCT marca_code) as total_marcas,
      COUNT(DISTINCT modelo_code) as total_modelos,
      COUNT(*) as total_veiculos
    FROM veiculos
  `);
  
  const stats = result2[0] ? {
    total_marcas: result2[0].values[0][0],
    total_modelos: result2[0].values[0][1],
    total_veiculos: result2[0].values[0][2]
  } : { total_marcas: 0, total_modelos: 0, total_veiculos: 0 };
  
  const result3 = db.exec('SELECT * FROM referencias ORDER BY updated_at DESC LIMIT 1');
  const ultimaReferencia = result3[0] ? {
    code: result3[0].values[0][0],
    month: result3[0].values[0][1],
    updated_at: result3[0].values[0][2]
  } : null;

  res.json({ 
    stats, 
    ultimaReferencia,
    ultimasAtualizacoes,
    token_configurado: !!process.env.FIPE_TOKEN
  });
});

cron.schedule('0 3 1 * *', async () => {
  console.log('🔄 Executando atualização agendada...');
  const { exec } = await import('child_process');
  exec('npm run update-fipe');
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor FIPE Backend rodando!`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📊 Status: http://localhost:${PORT}/api/status`);
  console.log(`\n💡 Dica: Execute 'npm run update-fipe' para popular o banco\n`);
});