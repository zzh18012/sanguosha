const { cpSync, existsSync, mkdirSync, rmSync } = require('fs');
const { join } = require('path');

const src = join(__dirname, '..', 'dist');
const dest = join(__dirname, 'public');

if (existsSync(dest)) rmSync(dest, { recursive: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log('Copied to server/public/');
