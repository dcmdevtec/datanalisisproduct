# ============================
# 🧱 Builder stage
# ============================
FROM node:20-alpine AS builder
WORKDIR /app

# Chromium del sistema para puppeteer-core (PDF de encuesta = HTML del
# preview renderizado por Chromium headless, ver app/api/surveys/[id]/pdf).
# Se usa el paquete de Alpine en vez del Chromium que descarga puppeteer por
# defecto porque ese binario no corre en musl libc (Alpine).
RUN apk add --no-cache chromium

# 🔥 AUMENTAR MEMORIA PARA NEXT BUILD
ENV NODE_OPTIONS="--max_old_space_size=4096"

# 🔥 DESACTIVAR CACHE DE WEBPACK
ENV NEXT_PRIVATE_DISABLE_WEBPACK_CACHE=1
ENV NEXT_PRIVATE_SKIP_CLOUD_CACHE=1
ENV DISABLE_V8_COMPILE_CACHE=1
ENV NEXT_CACHE_DISABLED=1
COPY package.json package-lock.json ./

# Instalar TODAS las dependencias
RUN npm ci --legacy-peer-deps

COPY . .

# Garantizar archivo env
RUN if [ -f .env.production ]; then echo ".env.production found"; else echo "" > .env.production; fi

# ⚡ Build con tu script corregido
RUN npm run build:safe

# Eliminar dependencias de desarrollo
RUN npm prune --production --legacy-peer-deps


# ============================
# 🚀 Runner stage
# ============================
FROM node:20-alpine AS runner
WORKDIR /app

# Mismo Chromium del sistema, ahora en la imagen que realmente corre en
# producción (el builder solo lo necesitaba para el build/type-check).
RUN apk add --no-cache chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .

# ⚠️ AGREGADO --legacy-peer-deps AQUÍ
RUN npm ci --omit=dev --legacy-peer-deps

COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/next.config.mjs .

COPY --from=builder /app/.env.production .env.production

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]