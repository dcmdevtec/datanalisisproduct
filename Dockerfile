# ============================
# 🧱 Builder stage
# ============================
FROM node:20-alpine AS builder
WORKDIR /app

# Variables para evitar cache pesada de Webpack
ENV NEXT_PRIVATE_DISABLE_WEBPACK_CACHE=1
ENV NEXT_PRIVATE_SKIP_CLOUD_CACHE=1
ENV DISABLE_V8_COMPILE_CACHE=1
ENV NODE_OPTIONS="--max_old_space_size=512"

# Copiamos dependencias
COPY package.json package-lock.json ./

# Instalamos dependencias completas (incluye dev)
RUN npm ci

# Copiamos el resto del proyecto
COPY . .

# Garantizamos el .env.production
RUN if [ -f .env.production ]; then echo ".env.production found"; else echo "" > .env.production; fi

# ⚡ Build Next.js sin cache de Webpack
RUN next build

# Eliminamos dependencias de desarrollo
RUN npm prune --production


# ============================
# 🚀 Runner stage
# ============================
FROM node:20-alpine AS runner
WORKDIR /app

# Copiamos archivos mínimos
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .

# Instalamos solo deps de producción
RUN npm ci --omit=dev

# Copiamos el build y assets
COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/next.config.mjs .

# Copiamos env de producción
COPY --from=builder /app/.env.production .env.production

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
