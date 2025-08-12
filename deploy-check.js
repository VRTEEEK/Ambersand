#!/usr/bin/env node

// Deployment pre-check script to validate environment and dependencies
console.log('🚀 Running deployment pre-check...');

// Check Node.js version
const nodeVersion = process.version;
console.log(`✅ Node.js version: ${nodeVersion}`);

// Check environment variables
const requiredEnvVars = [
  'DATABASE_URL',
  'REPL_SLUG',
  'REPL_OWNER',
  'PORT'
];

console.log('\n📋 Checking environment variables...');
let envValid = true;

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Present`);
  } else {
    console.log(`❌ ${envVar}: Missing`);
    envValid = false;
  }
});

// Check optional environment variables
const optionalEnvVars = [
  'NODE_ENV',
  'RESEND_API_KEY',
  'APP_URL'
];

console.log('\n📋 Checking optional environment variables...');
optionalEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: Present`);
  } else {
    console.log(`⚠️  ${envVar}: Not set (optional)`);
  }
});

// Test database connection
console.log('\n💾 Testing database connection...');
try {
  const { Pool } = await import('@neondatabase/serverless');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Test a simple query
  const client = await pool.connect();
  const result = await client.query('SELECT 1 as test');
  client.release();
  
  if (result.rows[0].test === 1) {
    console.log('✅ Database connection successful');
  } else {
    throw new Error('Unexpected database response');
  }
} catch (error) {
  console.log(`❌ Database connection failed: ${error.message}`);
  envValid = false;
}

console.log('\n🔧 Checking build files...');
const fs = await import('fs');
const path = await import('path');

const buildFiles = [
  'dist/index.js',
  'dist/public/index.html',
  'dist/public/assets'
];

buildFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}: Present`);
  } else {
    console.log(`❌ ${file}: Missing`);
    envValid = false;
  }
});

if (envValid) {
  console.log('\n🎉 Deployment pre-check passed! Ready to deploy.');
  process.exit(0);
} else {
  console.log('\n❌ Deployment pre-check failed! Please fix the issues above.');
  process.exit(1);
}