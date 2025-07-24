// Arquivo de desenvolvimento para TypeScript
import { AgentFrameworkServer } from './index.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🚀 Iniciando servidor em modo desenvolvimento...\n');

const server = new AgentFrameworkServer();
const port = parseInt(process.env.PORT || '3000');

server.start(port).catch((error: Error) => {
  console.error('❌ Erro ao iniciar servidor:', error);
  process.exit(1);
});

process.on('SIGINT', async () => {
  console.log('👋 Encerrando servidor de desenvolvimento...');
  await server.shutdown();
  process.exit(0);
});