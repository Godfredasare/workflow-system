require('dotenv').config();
const db = require('./db');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  console.log('==============================================');
  console.log('COCOBOD Workflow System - Database Initialization');
  console.log('==============================================');
  console.log();
  
  try {
    // Step 1: Create database if it doesn't exist
    console.log('Step 1: Checking/Creating database...');
    await db.createDatabase();
    
    // Step 2: Check connection
    console.log('Step 2: Testing connection...');
    const connected = await db.checkConnection();
    if (!connected) {
      throw new Error('Could not connect to database');
    }
    
    // Step 3: Initialize schema
    console.log('Step 3: Initializing schema...');
    await db.initializeDatabase();
    
    // Step 4: Run seed data
    console.log('Step 4: Seeding demo data...');
    const { seedDatabase } = require('./seed');
    await seedDatabase();
    
    console.log();
    console.log('==============================================');
    console.log('Database initialization completed successfully!');
    console.log('==============================================');
    console.log();
    console.log('Default login credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log();
    
    return true;
  } catch (error) {
    console.error();
    console.error('==============================================');
    console.error('Database initialization failed!');
    console.error('==============================================');
    console.error(error.message);
    console.error();
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = initializeDatabase;
