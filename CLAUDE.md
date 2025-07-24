# CLAUDE.md

Este arquivo fornece orientações para o Claude Code (claude.ai/code) ao trabalhar com o código neste repositório.

## Visão Geral do Projeto

O Agent Framework é um sistema multi-agente pronto para produção que combina configuração baseada em YAML (como o CrewAI) com uma poderosa orquestração de fluxo de trabalho. O framework permite a criação e coordenação de agentes de IA para tarefas complexas como pesquisa, geração de conteúdo e processamento de dados.

- Não crie `scripts/` de teste nesta pasta, crie os testes unitários corretamente em `tests/`.
- Não crie validações complexas e robustas, use algo mais simples que um humano criaria e usaria no código.
- Cuidado no uso dos ifs e elses.
- Não use elses e nem elses ifs.
- Não use try cats demasiadamente aninhados.
- Não altere variáveis existentes mesmo em refatoração, pois poderá casuar problemas permanentes e dificéis de identificar no projeto.

## Arquitetura Principal

### Componentes Principais
- **Agentes** (`src/agents/`): Agentes de IA individuais com papéis e capacidades específicas.
- **Equipes** (`src/crews/`): Orquestradores multi-agente que suportam processos sequenciais, hierárquicos e colaborativos.
- **Clientes LLM** (`src/llm/`): Clientes abstraídos para as APIs da OpenAI e OpenRouter.
- **Gerenciamento de Estado** (`src/state/`): Estado distribuído baseado em Redis com pub/sub para atualizações em tempo real.
- **Ferramentas** (`src/tools/`): Ferramentas integradas, incluindo web scraping (Playwright), operações Redis e integração com MCP.
- **Servidor WebSocket** (`src/websocket/`): Comunicação em tempo real para atualizações de status de agentes/equipes.
- **Sistema de Configuração** (`src/config/`): Carregador de configuração YAML com validação de esquemas Zod.

### Fluxo do Processo
1. Agentes são definidos em arquivos YAML com papéis, objetivos, histórias de fundo e configurações de ferramentas.
2. Equipes coordenam múltiplos agentes através de sequências de tarefas definidas.
3. O estado é gerenciado via Redis para persistência e comunicação entre agentes.
4. O WebSocket fornece atualizações em tempo real durante a execução.
5. Os resultados são armazenados e podem ser acessados via API REST.

## Comandos de Desenvolvimento

### Desenvolvimento Principal
```bash
# Desenvolvimento com hot-reload (usa nodemon + ts-node/esm)
npm run dev

# Build de produção
npm run build

# Iniciar servidor de produção
npm start
```

### Testes
```bash
# Rodar todos os testes
npm test

# Apenas testes de integração
npm run test:integration

# Apenas testes unitários
npm run test:unit

# Modo de observação (watch mode)
npm test -- --watch
```

### Qualidade do Código
```bash
# Lint de arquivos TypeScript
npm run lint

# Corrigir problemas de linting automaticamente
npm run lint:fix

# Limpar artefatos de build
npm run clean

# Limpar tudo, incluindo caches
npm run clean:all
```

## Sistema de Configuração

### Configuração de Agente (YAML)
Agentes são definidos usando YAML estruturado com estas seções principais:
- `id`, `name`, `role`, `goal`, `backstory`: Identidade principal do agente
- `llm`: Configuração do provedor LLM (OpenAI/OpenRouter com modelo, temperatura, tokens)
- `tools`: Array de ferramentas disponíveis (web_scraper, redis, mcp, custom)
- `system_prompt`: Instruções personalizadas para o agente
- `max_iterations`, `timeout`: Limites de execução

### Configuração de Equipe (YAML)
Equipes orquestram múltiplos agentes:
- `process`: Tipo de execução (sequencial, hierárquico, colaborativo)
- `agents`: Referências aos arquivos de configuração dos agentes
- `tasks`: Definições de tarefas estruturadas com atribuições de agentes e fluxo de contexto
- `context_from`: Sistema de dependência de tarefas para fluxo de dados entre agentes

### Variáveis de Ambiente
- `OPENAI_API_KEY`: Chave da API da OpenAI
- `OPENROUTER_API_KEY`: Chave da API da OpenRouter
- `REDIS_URL`: String de conexão do Redis (padrão: redis://localhost:6379)
- `PORT`: Porta do servidor (padrão: 3000)
- `NODE_ENV`: Modo de ambiente

## Dependências e Configuração

### Requisitos de Tempo de Execução
- Node.js 18+ (módulos ESM com resolução de especificador experimental)
- Redis 7+ para gerenciamento de estado e pub/sub
- Variáveis de ambiente para chaves de API LLM

### Dependências Chave
- Servidor Express com suporte a CORS e WebSocket
- TypeScript com configurações estritas e alvo ES2022
- Zod para validação de configuração
- Playwright para ferramentas de web scraping
- IORedis para operações Redis
- ws para implementação de WebSocket

### Configuração de Desenvolvimento
```bash
# Instalar e iniciar o Redis
redis-server

# Configurar ambiente
cp .env.example .env
# Edite .env com as chaves de API

# Instalar dependências e iniciar servidor de desenvolvimento
npm install
npm run dev
```

## Estratégia de Testes

O framework usa Jest com suporte a TypeScript:
- **Testes unitários**: Teste de componentes individuais (`tests/unit/`)
- **Testes de integração**: Teste de fluxo de trabalho completo (`tests/integration/`)
- **Suporte a ESM**: Configurado com ts-jest para módulos ES
- **Cobertura**: Coleta de todos os arquivos `src/`, exceto testes e servidor de desenvolvimento

## Estrutura da API

### Endpoints REST
- `GET /health` - Verificação de saúde
- `GET /api/agents` - Listar agentes
- `POST /api/agents` - Criar agente a partir da configuração
- `POST /api/agents/:id/execute` - Executar tarefa de um único agente
- `GET /api/crews` - Listar equipes
- `POST /api/crews` - Criar equipe a partir da configuração
- `POST /api/crews/:id/execute` - Executar fluxo de trabalho da equipe

### Eventos WebSocket
Atualizações em tempo real para status do agente, progresso da tarefa e estado de execução da equipe através do endpoint `/ws`.

## Organização de Arquivos

### Arquivos de Configuração
- Configurações de agente: `configs/agents/` ou `examples/` para amostras
- Configurações de equipe: `configs/crews/` ou `examples/` para amostras
- Modelos: `configs/templates/` para padrões reutilizáveis

### Estrutura do Código Fonte
- Lógica principal em `src/` com separação clara de responsabilidades
- Ponto de entrada do servidor: `src/server/index.ts` (produção) / `src/server/dev.ts` (desenvolvimento)
- Definições de tipo centralizadas no `types.ts` de cada módulo
- Esquemas definidos em `src/config/schemas.ts` usando Zod

Ao trabalhar com esta base de código, sempre considere a abordagem de configuração orientada por YAML, os requisitos de estado do Redis e os padrões de orquestração multi-agente. O framework foi projetado para uso em produção com tratamento de erros, logging e capacidades de monitoramento adequados.