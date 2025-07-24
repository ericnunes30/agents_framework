# Examples

Esta pasta contém exemplos práticos de como usar o Agent Framework.

## 📁 Estrutura

```
examples/
├── agents/          # Exemplos de agentes individuais
├── crews/           # Exemplos de crews (multi-agentes)
└── README.md        # Este arquivo
```

## 🚀 Como usar

### Executar um Agente
```bash
# Via API HTTP
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "examples/agents/basic-agent.yaml",
    "task": "Research the latest AI trends in 2025"
  }'

# Via WebSocket (conectar ao ws://localhost:3001/ws)
{
  "type": "agent.execute",
  "payload": {
    "configPath": "examples/agents/basic-agent.yaml", 
    "task": "Research the latest AI trends in 2025"
  }
}
```

### Executar um Crew
```bash
# Via API HTTP
curl -X POST http://localhost:3000/api/crews/execute \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "examples/crews/research-crew.yaml",
    "input": "Analyze the impact of AI on healthcare"
  }'
```

## 📋 Exemplos Disponíveis

### Agentes
- **basic-agent.yaml**: Agente pesquisador básico
- **web-scraper-agent.yaml**: Agente especializado em web scraping  
- **writing-agent.yaml**: Agente escritor de conteúdo

### Crews
- **research-crew.yaml**: Crew de pesquisa com múltiplos agentes

## 🛠️ Personalização

Para criar seus próprios agentes/crews, use os templates em `configs/templates/`:

```bash
cp configs/templates/agent-template.yaml my-custom-agent.yaml
# Edite my-custom-agent.yaml com suas configurações
```