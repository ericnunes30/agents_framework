# Production Agents

Esta pasta é destinada aos seus agentes de **produção** personalizados.

## 📋 Propósito

- ✅ **Seus agentes customizados** para uso em produção
- ✅ **Configurações específicas** do seu sistema
- ❌ **NÃO é para exemplos** (use `examples/agents/` para isso)

## 🚀 Como Criar um Agente

### 1. Use o template:
```bash
cp configs/templates/agent-template.yaml configs/agents/meu-agente.yaml
```

### 2. Personalize baseado nos exemplos:
```bash
# Veja os exemplos em:
ls examples/agents/
```

### 3. Configure para seu ambiente:
- Ajuste `llm.provider` e `llm.model`
- Configure `tools` necessárias
- Defina `system_prompt` específico
- Ajuste `max_iterations` e `timeout`

## 📁 Exemplo de Estrutura

```
configs/agents/
├── README.md                 # Este arquivo
├── research-specialist.yaml  # Seu agente de pesquisa
├── content-writer.yaml       # Seu agente escritor
└── data-analyzer.yaml        # Seu agente analista
```

## 🔧 Teste Seu Agente

```bash
# Via HTTP API
curl -X POST http://localhost:3000/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "configs/agents/meu-agente.yaml",
    "task": "Sua tarefa aqui"
  }'

# Via WebSocket
{
  "type": "agent.execute",
  "payload": {
    "configPath": "configs/agents/meu-agente.yaml",
    "task": "Sua tarefa aqui"
  }
}
```

---

💡 **Dica**: Mantenha esta pasta focada apenas nos agentes que você realmente usa em produção. Para aprender e testar, use os exemplos em `examples/agents/`.