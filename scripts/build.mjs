import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('build', { recursive: true, force: true });
mkdirSync('build', { recursive: true });
cpSync('dist', 'build', { recursive: true });
console.log('Static portfolio copied to build/');
