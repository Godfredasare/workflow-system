require('dotenv').config();
const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'cocobod_workflow',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Admin config (connects to 'postgres' database for admin operations)
const adminConfig = {
  ...dbConfig,
  database: 'postgres',
};

// Create connection pool
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool(dbConfig);
    pool.on('error', (err, client) => {
      console.error('Unexpected error on idle client', err);
    });
  }
  return pool;
}

// Query helper function
async function query(text, params = []) {
  const start = Date.now();
  const result = await getPool().query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Query executed in ${duration}ms: ${text.substring(0, 100)}...`);
  }
  return result;
}

// Get single row
async function queryOne(text, params = []) {
  const result = await query(text, params);
  return result.rows[0] || null;
}

// Get all rows
async function queryAll(text, params = []) {
  const result = await query(text, params);
  return result.rows;
}

// Execute raw SQL
async function executeSQL(sql) {
  await getPool().query(sql);
}

// Initialize database schema
async function initializeDatabase() {
  console.log('Initializing database schema...');
  
  const client = await getPool().connect();
  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await client.query(schema);
    console.log('Database schema initialized');
    
    return true;
  } catch (error) {
    console.error('Error initializing schema:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Check database connection
async function checkConnection() {
  try {
    const result = await queryOne('SELECT NOW() as now');
    console.log('Database connected:', result.now);
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    return false;
  }
}

// Create database if it doesn't exist
async function createDatabase() {
  const dbName = dbConfig.database;
  const client = new Client(adminConfig);
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL server');
    
    // Check if database exists
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    
    if (result.rows.length === 0) {
      // Create database
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database '${dbName}' created successfully`);
    } else {
      console.log(`Database '${dbName}' already exists`);
    }
    
    await client.end();
    return true;
  } catch (error) {
    console.error('Error creating database:', error.message);
    try {
      await client.end();
    } catch (e) {}
    return false;
  }
}

// Close pool
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database pool closed');
  }
}

// Transaction helper
async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback({
      query: (text, params) => client.query(text, params),
      queryOne: async (text, params) => {
        const res = await client.query(text, params);
        return res.rows[0] || null;
      },
      queryAll: async (text, params) => {
        const res = await client.query(text, params);
        return res.rows;
      }
    });
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Full setup: create database, schema, and seed
async function setup() {
  console.log('Starting full database setup...');
  
  // Step 1: Create database
  const dbCreated = await createDatabase();
  if (!dbCreated) {
    throw new Error('Failed to create database');
  }
  
  // Step 2: Initialize schema
  const schemaInit = await initializeDatabase();
  if (!schemaInit) {
    throw new Error('Failed to initialize schema');
  }
  
  // Step 3: Seed data
  const { seedDatabase } = require('./seed');
  await seedDatabase();
  
  console.log('Database setup completed!');
  return true;
}

module.exports = {
  getPool,
  query,
  queryOne,
  queryAll,
  executeSQL,
  initializeDatabase,
  checkConnection,
  createDatabase,
  closePool,
  transaction,
  setup,
  dbConfig
};
