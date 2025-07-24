# Production Crews

Esta pasta é destinada aos seus crews de **produção** personalizados.

## 📋 Propósito

- ✅ **Seus crews customizados** para uso em produção
- ✅ **Workflows específicos** do seu sistema
- ❌ **NÃO é para exemplos** (use `examples/crews/` para isso)

## 🚀 Como Criar um Crew

### 1. Use o template:
```bash
cp configs/templates/crew-template.yaml configs/crews/meu-crew.yaml
```

### 2. Personalize baseado nos exemplos:
```bash
# Veja os exemplos em:
ls examples/crews/
```

### 3. Configure para seu workflow:
- Defina `agents` que participarão
- Configure `process` (sequential, hierarchical, collaborative)
- Organize `tasks` com dependências corretas
- Ajuste `shared_context` conforme necessário

## 📁 Exemplo de Estrutura

```
configs/crews/
├── README.md                    # Este arquivo
├── content-creation-crew.yaml   # Seu crew de criação
├── research-analysis-crew.yaml  # Seu crew de pesquisa
└── data-processing-crew.yaml    # Seu crew de dados
```

## 🔧 Teste Seu Crew

```bash
# Via HTTP API
curl -X POST http://localhost:3000/api/crews/execute \
  -H "Content-Type: application/json" \
  -d '{
    "configPath": "configs/crews/meu-crew.yaml",
    "input": "Dados de entrada para o crew"
  }'

# Via WebSocket
{
  "type": "crew.execute",
  "payload": {
    "configPath": "configs/crews/meu-crew.yaml",
    "input": "Dados de entrada para o crew"
  }
}
```

---

💡 **Dica**: Mantenha esta pasta focada apenas nos crews que você realmente usa em produção. Para aprender e testar, use os exemplos em `examples/crews/`.