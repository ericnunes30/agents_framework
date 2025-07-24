# Agent Framework

Framework multi-agente pronto para produção que combina a simplicidade do YAML do CrewAI com o poder de workflow do LangGraph.

## 🚀 Características

- **Configuração YAML Simples**: Defina agentes e crews usando YAML intuitivo
- **Multi-Agente Avançado**: Processos sequenciais, hierárquicos e colaborativos
- **Integração LLM**: Suporte para OpenAI e OpenRouter
- **Estado Distribuído**: Gerenciamento com Redis para persistência
- **Comunicação em Tempo Real**: WebSocket para atualizações ao vivo
- **API REST Completa**: Interface HTTP para gerenciar agentes e crews
- **Ferramentas Integradas**: Web scraping, Redis, integração MCP

## 📦 Instalação Rápida

```bash
# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Editar .env com suas chaves de API

# Iniciar servidor
npm run dev
```

## 🌐 Integração HTTP e WebSocket

O Agent Framework oferece duas formas principais de integração:

### 🔗 API HTTP REST

Interface síncrona e assíncrona para execução de agentes e crews:

#### Execução Assíncrona de Agente
```bash
# Iniciar execução
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "examples/agents/basic-agent.yaml",
    "task": "Sua tarefa",
    "input": "Dados de entrada"
  }'

# Resposta:
# {"executionId": "agent_12345", "status": "started"}

# Verificar status
curl http://localhost:3000/api/agents/status/agent_12345

# Obter resultados
curl http://localhost:3000/api/agents/results/agent_12345
```

#### Execução de Crew
```bash
# Executar crew
curl -X POST http://localhost:3000/api/crews/execute \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "examples/crews/research-crew.yaml",
    "input": "Tema da pesquisa"
  }'
```

### ⚡ WebSocket Real-time

Comunicação em tempo real para monitoramento de execuções:

#### Conectar ao WebSocket
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Conectado ao WebSocket');
  
  // Subscrever a atualizações de um agente
  ws.send(JSON.stringify({
    type: 'subscribe_agent',
    data: { agentId: 'agent_12345' }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch(message.type) {
    case 'agent_update':
      console.log('Status do agente:', message.data);
      break;
    case 'crew_update':
      console.log('Status da crew:', message.data);
      break;
    case 'system_update':
      console.log('Sistema:', message.data);
      break;
  }
};
```

#### Subscrições Disponíveis
```javascript
// Subscrever a um agente específico
ws.send(JSON.stringify({
  type: 'subscribe_agent',
  data: { agentId: 'agent_12345' }
}));

// Subscrever a uma crew específica
ws.send(JSON.stringify({
  type: 'subscribe_crew',
  data: { crewId: 'crew_67890' }
}));

// Cancelar subscrição
ws.send(JSON.stringify({
  type: 'unsubscribe_agent',
  data: { agentId: 'agent_12345' }
}));
```

## 📚 Documentação

## 📋 Endpoints da API

### Agentes
- `GET /api/agents` - Listar todos os agentes
- `POST /api/agents` - Criar novo agente
- `GET /api/agents/:id` - Obter agente específico
- `POST /api/agents/execute` - Executar agente (assíncrono)
- `GET /api/agents/status/:executionId` - Status da execução
- `GET /api/agents/results/:executionId` - Resultados da execução
- `GET /api/agents/active` - Execuções ativas

### Crews
- `GET /api/crews` - Listar todas as crews
- `POST /api/crews` - Criar nova crew
- `GET /api/crews/:id` - Obter crew específica
- `POST /api/crews/:id/execute` - Executar crew
- `GET /api/crews/:id/logs` - Logs da execução
- `POST /api/crews/:id/cancel` - Cancelar execução

### Sistema
- `GET /health` - Verificação de saúde
- `GET /api/overview` - Visão geral do sistema
- `GET /api/config/agents` - Configurações de agentes disponíveis
- `GET /api/config/crews` - Configurações de crews disponíveis
- `GET /api/tools` - Ferramentas disponíveis

## 📊 Formato das Respostas

### Iniciar Execução
```json
{
  "executionId": "agent_12345",
  "status": "started"
}
```

### Status da Execução
```json
{
  "executionId": "agent_12345",
  "status": "running",
  "progress": 0.75,
  "currentStep": "processing",
  "startTime": "2025-01-24T10:00:00Z"
}
```

### Resultado da Execução
```json
{
  "executionId": "agent_12345",
  "result": "Resultado final do agente",
  "metadata": {
    "configPath": "examples/agents/basic-agent.yaml",
    "task": "Pesquisa sobre IA",
    "tokensUsed": 1500
  },
  "executionTime": 45000,
  "completedAt": "2025-01-24T10:01:30Z"
}
```

## 🔌 Integração com Ferramentas Externas

### n8n Integration
Consulte `examples/n8n/` para workflows completos de integração com n8n, incluindo:
- Execução HTTP com polling de status
- Streaming em tempo real via WebSocket
- Tratamento de erros e retry logic

### Outras Integrações
- **Zapier**: Use webhooks HTTP para conectar com workflows
- **Make.com**: Integre via HTTP requests e WebSocket connections
- **Custom Apps**: Implemente clientes usando as APIs REST e WebSocket

## 📚 Documentação

- **[Guia de Instalação](docs/guides/DEPLOYMENT.md)** - Deploy e configuração
- **[Documentação da API](docs/api/)** - Endpoints e integração
- **[Arquitetura](docs/architecture/)** - Estrutura técnica
- **[Exemplos](examples/)** - Configurações prontas

## 🛠️ Comandos

```bash
npm run dev          # Desenvolvimento
npm run build        # Build de produção
npm start           # Servidor de produção
npm test            # Todos os testes
npm run test:unit   # Testes unitários
npm run test:integration # Testes de integração
```

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `PORT` | Porta do servidor | 3000 |
| `REDIS_URL` | URL do Redis | redis://localhost:6379 |
| `OPENAI_API_KEY` | Chave API OpenAI | - |
| `OPENROUTER_API_KEY` | Chave API OpenRouter | - |
| `USE_HYBRID` | Usar servidor híbrido | true |

## 🚨 Tratamento de Erros

### Códigos HTTP
- `400` - Bad Request (parâmetros inválidos)
- `404` - Not Found (recurso não encontrado)
- `429` - Rate Limited (muitas requisições)
- `500` - Internal Server Error

### Mensagens WebSocket
```json
{
  "type": "error",
  "data": {
    "message": "Descrição do erro",
    "code": "ERROR_CODE"
  },
  "timestamp": "2025-01-24T10:00:00Z"
}
```

## 📄 Licença

MIT