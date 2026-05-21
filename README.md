# n8n-g4f-router v2.0.0

> **Um proxy inteligente de auto-failover para conectar n8n ao gpt4free (g4f), garantindo alta disponibilidade.**

Este projeto resolve o principal problema do `g4f`: a **instabilidade** dos provedores. Enquanto o `g4f` é poderoso, seus provedores ficam offline constantemente. Se você conectar o n8n diretamente a um provedor, seu workflow vai falhar assim que ele cair.

O `n8n-g4f-router` age como um "gerente inteligente" que fica entre o n8n e o `g4f`, roteando automaticamente para o próximo provedor saudável em caso de falha — de forma completamente transparente para o n8n.

---

## 🎯 Funcionalidades

- **Auto-failover automático** — Se um provedor falhar, o router tenta o próximo da lista instantaneamente.
- **Health checks ativos** — O router testa todos os provedores periodicamente, sabendo em tempo real quais estão funcionando.
- **API 100% compatível com OpenAI** — Use o nó nativo "OpenAI" do n8n, sem nós HTTP complexos.
- **Endpoint `/v1/models`** — Lista os modelos disponíveis, compatível com a seleção de modelos do n8n.
- **Endpoint `/health`** — Status detalhado dos provedores, ideal para monitoramento e Docker healthcheck.
- **Graceful shutdown** — Desliga corretamente ao receber SIGTERM (Docker stop).
- **Autenticação por Bearer Token** — Protege o endpoint do router com uma chave de API.

---

## 🏗️ Arquitetura

```
n8n ──► n8n-g4f-router ──► g4f (Service)
(OpenAI Node)  (Este projeto)  (gpt4free)
```

1. O **n8n** faz uma chamada para o `n8n-g4f-router` (achando que é a API oficial da OpenAI).
2. O **Router** consulta sua lista interna de provedores saudáveis para o modelo solicitado.
3. Ele encaminha a requisição para o primeiro provedor saudável.
4. Se o provedor falhar, o Router captura o erro, marca o provedor como "offline" e tenta o próximo automaticamente.
5. A resposta bem-sucedida é enviada de volta ao n8n.

---

## 🚀 Início Rápido

### Pré-requisitos

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)

### Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/dsc2q/n8n-g4f-router.git
cd n8n-g4f-router

# 2. Crie o arquivo de ambiente a partir do exemplo
cp .env.example .env

# 3. Edite o .env e defina uma chave segura
# ROUTER_API_KEY=minha_chave_super_secreta_123

# 4. Inicie os serviços
docker-compose up -d --build
```

O router estará disponível em `http://localhost:3000`.

---

## 🤖 Configurando no n8n

1. No n8n, vá em **Credentials** e adicione uma nova credencial **OpenAI API**.
2. Preencha os campos:
   - **API Key:** O valor de `ROUTER_API_KEY` do seu `.env`
   - **Base URL (em "Advanced"):** `http://localhost:3000/v1`
3. Salve a credencial.
4. Em qualquer workflow, adicione o nó **OpenAI (Chat Model)**, selecione a credencial `g4f Router` e use normalmente!

---

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|:---------|:----------|:-------|
| `ROUTER_PORT` | Porta em que o router escuta | `3000` |
| `G4F_UPSTREAM_URL` | URL interna do serviço `g4f` | `http://g4f:8080` |
| `ROUTER_API_KEY` | Bearer Token para proteger o router | **(Obrigatório)** |
| `HEALTH_CHECK_INTERVAL_MS` | Intervalo (em ms) entre os health checks | `300000` (5 min) |

---

## 📡 Endpoints

| Endpoint | Auth | Descrição |
|:---------|:-----|:----------|
| `GET /` | ❌ | Status básico do router |
| `GET /health` | ❌ | Status detalhado de todos os provedores |
| `GET /v1/models` | ✅ | Lista de modelos suportados |
| `POST /v1/chat/completions` | ✅ | Endpoint principal de chat com failover |

---

## 🤖 Modelos Suportados

| Família | Modelos |
|:--------|:--------|
| **GPT-4o** | `gpt-4o`, `gpt-4o-mini` |
| **GPT-4** | `gpt-4`, `gpt-4-turbo` |
| **GPT-3.5** | `gpt-3.5-turbo` |
| **Gemini** | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, `gemini-2.5-flash` |
| **Claude** | `claude-3-haiku`, `claude-3-sonnet`, `claude-3-opus`, `claude-3-5-sonnet`, `claude-3-7-sonnet` |
| **Llama** | `llama-3.1-8b`, `llama-3.1-70b`, `llama-3.3-70b` |
| **DeepSeek** | `deepseek-v3`, `deepseek-r1`, `deepseek-chat` |
| **Mistral** | `mixtral-8x7b`, `mistral-7b`, `mistral-small` |
| **Qwen** | `qwen-2.5-72b`, `qwen-2-72b` |
| **Blackbox** | `blackboxai`, `blackboxai-pro` |

---

## 🐛 O que foi corrigido na v2.0.0

- ✅ `package.json` criado (estava ausente — o projeto não compilava)
- ✅ `.env.example` criado (estava ausente — referenciado no README mas não existia)
- ✅ `Dockerfile` corrigido — faltava `COPY --from=builder`, `CMD`, e `HEALTHCHECK`
- ✅ `docker-compose.yaml` corrigido — faltavam variáveis de ambiente, `depends_on`, e `networks` completos
- ✅ `src/config.ts` corrigido — campos `g4fUpstreamUrl` e `healthCheckIntervalMs` estavam truncados
- ✅ `src/server.ts` corrigido — lógica do endpoint raiz truncada; adicionado `/health`, graceful shutdown e 404 handler
- ✅ `src/middleware/auth.ts` corrigido — condição de auth truncada; agora retorna erros no formato OpenAI
- ✅ `src/routes/openAIRouter.ts` corrigido — streaming e error handling incompletos; adicionado `/v1/models`
- ✅ `src/services/providerManager.ts` corrigido — health check e métodos essenciais estavam truncados
- ✅ Provedores atualizados para 2025/2026 (removidos: GeekGpt, Anondrop, Raycast, Pi, Bing, Phind, ChatBase)
- ✅ Modelos atualizados com famílias Gemini 2.x, Claude 3.x, DeepSeek, Qwen

---

## 📄 Licença

MIT