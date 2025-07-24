const WebSocket = require('ws');

console.log('🧪 Testando WebSocket do Agent Framework...');

const ws = new WebSocket('ws://localhost:3001/ws');

ws.on('open', () => {
  console.log('🟢 WebSocket conectado com sucesso\!');
  
  // Testar execução de agente via WebSocket
  const message = {
    type: 'agent.execute',
    payload: {
      configPath: 'basic-agent.yaml',
      task: 'Qual é a capital do Brasil?'
    }
  };
  
  console.log('📡 Enviando:', JSON.stringify(message, null, 2));
  ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    console.log('📨 Recebido:', {
      type: msg.type,
      hasExecutionId: \!\!(msg.data && msg.data.executionId),
      timestamp: msg.timestamp || 'sem timestamp'
    });
    
    if (msg.data && msg.data.executionId) {
      console.log('✅ Execução iniciada via WebSocket:', msg.data.executionId);
      setTimeout(() => ws.close(), 2000);
    }
  } catch (e) {
    console.log('📨 Mensagem raw:', data.toString().substring(0, 100));
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket erro:', error.message);
});

ws.on('close', () => {
  console.log('🔴 WebSocket desconectado');
});

setTimeout(() => {
  console.log('⏰ Timeout - fechando WebSocket');
  ws.close();
}, 10000);
