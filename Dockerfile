FROM node:20-alpine

WORKDIR /app

# Instalar dependências do sistema para Playwright
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    curl

# Configurar variáveis de ambiente para Playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Copiar arquivos de dependências
COPY package*.json ./

# Instalar todas as dependências (incluindo dev para build)
RUN npm ci

# Copiar código fonte
COPY src/ ./src/
COPY tsconfig.json ./

# Build do TypeScript
RUN npm run build

# Remover dependências de desenvolvimento
RUN npm prune --production

# Criar diretórios necessários
RUN mkdir -p config examples

# Expor porta
EXPOSE 3000

# Comando de inicialização
CMD ["npm", "start"]