import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const DB_PATH = 'fipe.db';

const SQL = await initSqlJs();

let db;
if (existsSync(DB_PATH)) {
  const buffer = readFileSync(DB_PATH);
  db = new SQL.Database(buffer);
  console.log('Banco de dados carregado');
} else {
  db = new SQL.Database();
  console.log('Novo banco de dados criado');
}

export function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

db.run('CREATE TABLE IF NOT EXISTS referencias (code TEXT PRIMARY KEY, month TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');

db.run('CREATE TABLE IF NOT EXISTS marcas (code TEXT NOT NULL, name TEXT NOT NULL, tipo_veiculo TEXT NOT NULL, PRIMARY KEY (code, tipo_veiculo))');

db.run('CREATE TABLE IF NOT EXISTS modelos (code TEXT NOT NULL, marca_code TEXT NOT NULL, name TEXT NOT NULL, tipo_veiculo TEXT NOT NULL, PRIMARY KEY (code, marca_code, tipo_veiculo))');

db.run('CREATE TABLE IF NOT EXISTS veiculos (id INTEGER PRIMARY KEY AUTOINCREMENT, vehicle_type TEXT, brand TEXT, model TEXT, model_year INTEGER, fuel TEXT, fuel_acronym TEXT, code_fipe TEXT, price TEXT, reference_month TEXT, marca_code TEXT, modelo_code TEXT, year_id TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)');

db.run('CREATE TABLE IF NOT EXISTS atualizacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, tipo_veiculo TEXT NOT NULL, data_atualizacao TEXT DEFAULT CURRENT_TIMESTAMP, registros_atualizados INTEGER, status TEXT)');

db.run('CREATE INDEX IF NOT EXISTS idx_veiculos_marca ON veiculos(marca_code)');
db.run('CREATE INDEX IF NOT EXISTS idx_veiculos_modelo ON veiculos(modelo_code)');
db.run('CREATE INDEX IF NOT EXISTS idx_veiculos_code_fipe ON veiculos(code_fipe)');
db.run('CREATE INDEX IF NOT EXISTS idx_veiculos_tipo ON veiculos(vehicle_type)');

saveDatabase();

console.log('Tabelas criadas com sucesso');

export default db;