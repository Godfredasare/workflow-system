require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || supabaseKey;

// Create Supabase client
let supabase = null;

function getClient() {
  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabase;
}

// Query helper function using RPC or direct table queries
async function query(table, options = {}) {
  const client = getClient();
  let query = client.from(table).select(options.select || '*', { count: options.count });

  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
  }

  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { rows: data, count };
}

// Raw SQL query using RPC (requires a function in Supabase)
async function rpc(functionName, params = {}) {
  const client = getClient();
  const { data, error } = await client.rpc(functionName, params);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Insert into table
async function insert(table, data) {
  const client = getClient();
  const { data: result, error } = await client
    .from(table)
    .insert(data)
    .select();

  if (error) {
    throw new Error(error.message);
  }

  return result;
}

// Update table
async function update(table, data, filter) {
  const client = getClient();
  let query = client.from(table).update(data);

  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(key, value);
  }

  const { data: result, error } = await query.select();

  if (error) {
    throw new Error(error.message);
  }

  return result;
}

// Delete from table
async function deleteRecord(table, filter) {
  const client = getClient();
  let query = client.from(table).delete();

  for (const [key, value] of Object.entries(filter)) {
    query = query.eq(key, value);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

// Get single row
async function queryOne(table, options = {}) {
  const client = getClient();
  let query = client.from(table).select(options.select || '*').limit(1);

  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
  }

  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// Get all rows
async function queryAll(table, options = {}) {
  const client = getClient();
  let query = client.from(table).select(options.select || '*');

  if (options.filter) {
    for (const [key, value] of Object.entries(options.filter)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }
  }

  if (options.order) {
    query = query.order(options.order.column, { ascending: options.order.ascending ?? false });
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

// Raw query for complex SQL (stored procedures must exist in Supabase)
async function rawQuery(sql, params = []) {
  // For complex queries, use stored procedures in Supabase
  // or use the REST API with filters
  console.warn('Raw SQL queries require stored procedures in Supabase');
  throw new Error('Use stored procedures or table methods for Supabase queries');
}

// Check connection
async function checkConnection() {
  try {
    const client = getClient();
    const { data, error } = await client.from('users').select('id').limit(1);
    if (error && !error.message.includes('does not exist')) {
      console.error('Supabase connection error:', error.message);
      return false;
    }
    console.log('Supabase connected successfully');
    return true;
  } catch (error) {
    console.error('Supabase connection error:', error.message);
    return false;
  }
}

// Initialize database schema (runs SQL file via Supabase SQL Editor or migration)
async function initializeDatabase() {
  console.log('Database initialization should be done via Supabase dashboard or migrations');
  console.log('Please run the schema.sql file in the Supabase SQL Editor');
  return true;
}

// Close connection (Supabase client doesn't need explicit closing)
async function closePool() {
  supabase = null;
  console.log('Supabase client reset');
}

// Transaction support via Supabase (requires stored procedure)
async function transaction(callback) {
  // Supabase handles transactions via stored procedures
  // For complex transactions, create a stored procedure in Supabase
  console.warn('Transactions in Supabase require stored procedures');
  throw new Error('Use stored procedures for Supabase transactions');
}

// Storage functions for file uploads
async function uploadFile(bucket, path, file, options = {}) {
  const client = getClient();
  const { data, error } = await client.storage
    .from(bucket)
    .upload(path, file, options);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function downloadFile(bucket, path) {
  const client = getClient();
  const { data, error } = await client.storage
    .from(bucket)
    .download(path);

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getPublicUrl(bucket, path) {
  const client = getClient();
  const { data } = client.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

// Real-time subscription helper
function subscribe(table, callback, filter = null) {
  const client = getClient();
  let channel = client.channel(`${table}_changes`);

  channel = channel.on(
    'postgres_changes',
    {
      event: '*',
      schema: 'public',
      table: table,
      filter: filter
    },
    callback
  );

  channel.subscribe();
  return channel;
}

module.exports = {
  getClient,
  query,
  queryOne,
  queryAll,
  insert,
  update,
  delete: deleteRecord,
  rpc,
  rawQuery,
  checkConnection,
  initializeDatabase,
  closePool,
  transaction,
  uploadFile,
  downloadFile,
  getPublicUrl,
  subscribe
};
