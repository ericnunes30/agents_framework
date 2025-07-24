# Agent Framework

Framework de agentes multi-agente em produção que combina a simplicidade do YAML do CrewAI com o poder de workflow do LangGraph.

## 🚀 Características

- **Configuração YAML Simples**: Defina agentes e crews usando YAML intuitivo
- **Multi-Agente Avançado**: Suporte para processos sequenciais, hierárquicos e colaborativos
- **Integração LLM**: Suporte para OpenAI e OpenRouter via APIs HTTP
- **Estado Distribuído**: Gerenciamento de estado com Redis para persistência e pub/sub
- **Comunicação em Tempo Real**: WebSocket para atualizações ao vivo de agentes/crews
- **Ferramentas Integradas**: Web scraping com Playwright, operações Redis, integração MCP
- **API REST Completa**: Interface HTTP para gerenciar agentes, crews e execuções

## 📦 Instalação

### Pré-requisitos
- Node.js 18+
- Redis 7+
- Docker (opcional)

### Instalação Rápida

```bash
# Clone o repositório
git clone <repository-url>
cd agent-framework

# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env
# Edite .env com suas chaves de API

# Iniciar Redis (desenvolvimento)
npm run docker:dev

# Desenvolvimento
npm run dev
```

### Docker (Recomendado)

```bash
# Desenvolvimento (apenas Redis)
npm run docker:dev

# Produção (stack completa)
npm run docker:up

# Parar serviços
docker-compose down

# Verificar logs
npm run docker:logs
```

## 🏗️ Estrutura do Projeto

```
agent-framework/
├── src/                    # Código fonte principal
│   ├── agents/            # Sistema de agentes
│   ├── crews/             # Orquestração multi-agente  
│   ├── llm/               # Clientes LLM (OpenAI, OpenRouter)
│   ├── state/             # Gerenciamento de estado Redis
│   ├── tools/             # Ferramentas integradas
│   ├── websocket/         # Servidor WebSocket
│   └── server/            # Servidor HTTP/WebSocket
├── examples/              # Exemplos práticos
│   ├── agents/           # Exemplos de agentes
│   ├── crews/            # Exemplos de crews
│   └── README.md         # Guia de uso dos exemplos
├── configs/              # Configurações do sistema
│   ├── agents/          # Agentes de sistema
│   └── templates/       # Templates para criar novos
├── tests/               # Todos os testes
│   ├── unit/           # Testes unitários
│   ├── integration/    # Testes de integração
│   └── examples/       # Scripts de teste dos exemplos
├── scripts/            # Scripts utilitários
│   ├── setup-dev.sh   # Setup desenvolvimento
│   └── build-docker.sh # Build Docker
└── docs/              # Documentação (se necessário)
```
├── config/               # Configurações YAML
├── docker-compose.yml    # Configuração Docker
└── Dockerfile           # Imagem Docker
```

## 🎯 Uso Rápido

### 1. Criar um Agente Simples

Crie `config/my-agent.yaml`:

```yaml
id: my-researcher
name: My Research Agent
role: Research specialist
backstory: Expert researcher with years of experience
goal: Conduct thorough research and provide insights

llm:
  provider: openai
  model: gpt-4.1-mini
  temperature: 0.7

tools:
  - name: web_scraper
    enabled: true
  - name: redis
    enabled: true
```

### 2. Criar uma Crew

Crie `config/my-crew.yaml`:

```yaml
id: research-team
name: Research Team
process: sequential

agents:
  - config_path: config/my-agent.yaml
    id: researcher

tasks:
  - name: research_topic
    description: Research the given topic thoroughly
    agent: researcher
    expected_output: Comprehensive research summary
```

### 3. Executar via API

```bash
# Criar e executar uma crew
curl -X POST http://localhost:3000/api/crews \
  -H "Content-Type: application/json" \
  -d '{"configPath": "config/my-crew.yaml"}'

# Executar a crew com input
curl -X POST http://localhost:3000/api/crews/research-team/execute \
  -H "Content-Type: application/json" \
  -d '{"input": "Latest developments in AI for 2024"}'
```

## 📡 API REST

### Endpoints Principais

- `GET /health` - Health check
- `GET /api/agents` - Listar todos os agentes
- `POST /api/agents` - Criar novo agente
- `POST /api/agents/:id/execute` - Executar tarefa com agente
- `GET /api/crews` - Listar todas as crews
- `POST /api/crews` - Criar nova crew
- `POST /api/crews/:id/execute` - Executar crew
- `GET /ws` - Conexão WebSocket para atualizações em tempo real

### Documentação Completa

Acesse `http://localhost:3000/health` para verificar se o servidor está funcionando.

## 🛠️ Ferramentas Disponíveis

### Web Scraper
```yaml
tools:
  - name: web_scraper
    config:
      timeout: 30000
      headless: true
      take_screenshot: true
```

### Redis Operations
```yaml
tools:
  - name: redis
    config:
      url: redis://localhost:6379
```

## 📊 Exemplos

Confira os exemplos na pasta `examples/`:

- `basic-agent.yaml` - Agente de pesquisa básico
- `web-scraper-agent.yaml` - Agente especializado em web scraping
- `writing-agent.yaml` - Agente criador de conteúdo
- `research-crew.yaml` - Crew completo de pesquisa

## 🔧 Desenvolvimento Local

### Configuração de Desenvolvimento

#### 1. Instalação Local Completa

```bash
# Clone o repositório
git clone <repository-url>
cd agent-framework

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env

# Edite .env com suas chaves de API:
# OPENAI_API_KEY=sk-...
# OPENROUTER_API_KEY=sk-...
# REDIS_URL=redis://localhost:6379
```

#### 2. Iniciar Dependências

```bash
# Opção A: Docker (recomendado)
docker-compose up -d redis

# Opção B: Redis local
# Instale Redis e execute:
redis-server

# Verificar se Redis está rodando:
redis-cli ping  # Deve retornar "PONG"
```

#### 3. Desenvolvimento com Hot-Reload

```bash
# Modo desenvolvimento (compilação automática)
npm run dev

# Modo desenvolvimento com TypeScript puro
npm run build -- --watch &
npm start
```

#### 4. Servidor Local

**Portas padrão:**
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws`
- Redis: `localhost:6379`

**Comandos úteis:**
```bash
# Iniciar servidor em produção
npm start

# Build manual
npm run build

# Limpar build anterior
rm -rf dist/
npm run build
```

### Testes e Debug

#### Testes Rápidos
```bash
# Testar conexão com Redis
node test-redis.js

# Verificar estrutura do framework
node test-ready.js

# Testar API localmente
curl http://localhost:3000/health
```

#### Testes de Desenvolvimento
```bash
# Executar todos os testes
npm test

# Testes de integração
npm run test:integration

# Testes com watch
npm test -- --watch

# Linting
npm run lint
npm run lint:fix
```

### Debug Avançado

#### Logs Detalhados
```bash
# Logs detalhados do servidor
DEBUG=* npm start

# Logs específicos do framework
DEBUG=agent-framework:* npm run dev
```

#### Testar API Manualmente
```bash
# Health check
curl http://localhost:3000/health

# Listar agentes
curl http://localhost:3000/api/agents

# Listar crews
curl http://localhost:3000/api/crews

# Criar agente de teste
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"configPath": "examples/basic-agent.yaml"}'

# Executar tarefa simples
curl -X POST http://localhost:3000/api/agents/basic-researcher/execute \
  -H "Content-Type: application/json" \
  -d '{"task": "Explique o que é TypeScript"}'
```

### Ambientes de Desenvolvimento

#### VS Code Setup
Instale as extensões recomendadas:
- ESLint
- Prettier
- TypeScript Importer
- Thunder Client (para testar API)

#### Configuração .env para Desenvolvimento
```bash
# .env
NODE_ENV=development
PORT=3000
REDIS_URL=redis://localhost:6379
OPENAI_API_KEY=your-openai-key
OPENROUTER_API_KEY=your-openrouter-key
LOG_LEVEL=debug
```

#### Scripts Úteis
```bash
# Limpar tudo e recomeçar
npm run clean && npm install && npm run build

# Verificar configurações YAML
node -e "import('./src/config/loader.js').then(m => console.log('Configurações válidas!'))"

# Testar WebSocket
node -e "
const ws = new WebSocket('ws://localhost:3000/ws');
ws.on('open', () => console.log('WebSocket conectado'));
ws.on('message', (data) => console.log('Mensagem:', data.toString()));
"
```

### Troubleshooting Local

#### Problemas Comuns

**Redis não conecta:**
```bash
# Verificar se Redis está rodando
netstat -an | grep 6379
# ou
lsof -i :6379

# Se não estiver, inicie:
redis-server
```

**Porta 3000 ocupada:**
```bash
# Verificar o que está usando a porta
lsof -i :3000

# Usar porta diferente
PORT=3001 npm start
```

**Erros de TypeScript:**
```bash
# Limpar cache e recompilar
rm -rf dist/ node_modules/.cache
tsc --noEmit
```

**Playwright não funciona:**
```bash
# Instalar navegadores do Playwright
npx playwright install
```

#### Monitoramento Local
```bash
# Monitorar Redis
redis-cli monitor

# Monitorar logs em tempo real
tail -f logs/app.log  # se configurado
```

### Configuração para Desenvolvimento com Docker

#### Desenvolvimento com Docker Compose
```bash
# Desenvolvimento com volume bind
# Crie docker-compose.dev.yml para desenvolvimento
```

#### Live Reload com Docker
```bash
# Para desenvolvimento com live reload
# Use nodemon dentro do container
```

## 🔧 Desenvolvimento

```bash
# Desenvolvimento com hot-reload
npm run dev

# Linting
npm run lint
npm run lint:fix

# Testes
npm test
npm run test:integration

# Build
npm run build
```

## 🌍 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|---------|
| `PORT` | Porta do servidor | 3000 |
| `REDIS_URL` | URL do Redis | redis://localhost:6379 |
| `OPENAI_API_KEY` | Chave API OpenAI | - |
| `OPENROUTER_API_KEY` | Chave API OpenRouter | - |
| `NODE_ENV` | Ambiente | development |

## 🐳 Docker

```bash
# Build personalizado
docker build -t agent-framework .

# Executar container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  agent-framework
```

## 🚨 Troubleshooting

### Problemas Comuns

1. **Erro de conexão Redis**: Verifique se o Redis está rodando na porta 6379
2. **Erro de API Key**: Configure as chaves de API no arquivo .env
3. **Erro de permissão Playwright**: No Linux, instale as dependências: `sudo apt-get install chromium-browser`

### Debug

```bash
# Ver logs detalhados
DEBUG=agent-framework:* npm start

# Ver logs do Docker
docker-compose logs -f agent-framework
```

## 🤝 Contribuindo

1. Faça fork do projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 🆘 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato com a equipe de desenvolvimento.

---

**Agent Framework** - Produção-ready multi-agent framework com simplicidade YAML e poder de workflow.