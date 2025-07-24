### **Guia Técnico para Construção de Agentes e Crews**

Este documento detalha os princípios técnicos e os componentes essenciais para a construção de agentes e equipes (crews) dentro deste framework.

#### **1\. Anatomia de um Agente (agent.yaml)**

Um Agente é a unidade fundamental de execução. Sua definição em YAML é composta por três áreas críticas que determinam seu comportamento:

* **Identidade e Propósito (Persona):**  
  * id: Identificador único, usado para referência em crews.  
  * role: A "profissão" do agente. Define sua especialidade (ex: "Especialista em análise de código").  
  * goal: O objetivo macro que o agente deve cumprir. É a sua diretriz principal.  
  * backstory: O contexto que dá ao LLM a "personalidade" e o tom a ser adotado. Essencial para refinar o comportamento.  
* **Capacidades (Tools & LLM):**  
  * llm: Define o cérebro do agente.  
    * provider: openai ou openrouter. Determina qual cliente de API será usado.  
    * model: O modelo específico a ser chamado (ex: gpt-4.1-mini).  
    * temperature: Controla a criatividade vs. determinismo. Valores baixos (ex: 0.2) para tarefas técnicas; valores altos (ex: 0.8) para tarefas criativas.  
  * tools: Define as habilidades externas do agente. Um agente só pode usar as ferramentas listadas aqui. As ferramentas disponíveis são gerenciadas pelo NativeToolManager \[cite: agentes\_framework/src/tools/native/NativeToolManager.ts\].  
* **Diretrizes de Execução:**  
  * system\_prompt: A instrução mais importante. É a regra de ouro que o agente seguirá em todas as execuções. Deve ser claro, imperativo e, se possível, numerado.  
  * max\_iterations: Limite de "loops" de pensamento ou ações que um agente pode tomar para completar uma tarefa. Um mecanismo de segurança contra loops infinitos.

#### **2\. Orquestração de Agentes (crew.yaml)**

Um Crew é um time de agentes coordenados para resolver um problema complexo. A chave para um Crew eficaz é a definição do fluxo de trabalho.

* **Composição da Equipe:**  
  * agents: Lista os ids dos agentes que fazem parte da equipe. O CrewRunner irá carregar e instanciar cada um deles \[cite: agentes\_framework/src/crews/CrewRunner.ts\].  
* **Modelo de Processo (process):**  
  * sequential: **Linha de Montagem.** Uma tarefa é executada após a outra. Ideal para processos lineares onde o output de uma etapa é o input da próxima.  
  * hierarchical: **Gerente e Subordinados.** O primeiro agente da lista atua como gerente, planejando e delegando tarefas para os demais. No final, ele revisa o trabalho consolidado.  
  * collaborative: **Mesa Redonda.** Todos os agentes trabalham de forma simultânea (ou em rodadas), compartilhando informações em um contexto comum para chegar a um consenso ou resultado refinado.

#### **3\. Fluxo de Dados e Contexto (context)**

O context é o mecanismo que permite a passagem de informação entre as tarefas de um Crew. É a espinha dorsal da colaboração.

* **Dependência de Tarefas:**  
  * A propriedade context em uma task define de quais tarefas anteriores ela depende.  
  * Exemplo: context: \[scrape\_data, analyze\_data\] significa que a tarefa atual só será executada após scrape\_data e analyze\_data terminarem, e receberá os resultados de ambas.  
* **Como os Dados são Passados:**  
  * O Crew mantém um objeto previousResults que mapeia o id de cada tarefa ao seu resultado final.  
  * Quando uma nova tarefa é executada, o Crew injeta os resultados das tarefas listadas em context no prompt do agente atual.  
  * Isso garante que o agente tenha toda a informação necessária para executar seu trabalho sem precisar perguntar ou buscar novamente.  
* **Contexto Compartilhado (sharedContext):**  
  * Um "quadro branco" global para o Crew.  
  * É um objeto de dados que todos os agentes podem ler e (potencialmente) modificar durante a execução.  
  * Útil para informações que precisam ser acessíveis por todas as tarefas, independentemente da ordem, como o input inicial do usuário ou configurações globais para a execução.