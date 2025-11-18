# ============================
# 🧱 Builder stage
# ============================
FROM node:20-alpine AS builder
WORKDIR /app

# Copiamos los archivos de dependencias primero (para aprovechar cache)
COPY package.json package-lock.json ./

# Instalamos dependencias (con devDependencies para el build)
RUN npm ci

# Copiamos el resto del proyecto
COPY . .

# 👇 Aseguramos que el .env.production exista antes de usarlo
RUN if [ -f .env.production ]; then echo ".env.production found"; else echo "" > .env.production; fi

# ✅ Construimos la aplicación Next.js (usando las variables de .env.production)
# Se usa "sh -c" para asegurar compatibilidad con Alpine
RUN /bin/sh -c "npm run build:safe"

# Eliminamos dependencias de desarrollo para reducir tamaño
RUN npm prune --production


# ============================
# 🚀 Runner stage
# ============================
FROM node:20-alpine AS runner
WORKDIR /app

# Copiamos solo lo necesario desde el builder
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production dependencies in the runner to avoid copying the whole node_modules
RUN npm ci --omit=dev

# Copy built app files and public assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Copy the production env if provided
COPY --from=builder /app/.env.production ./.env.production

# Set node environment
ENV NODE_ENV=production

# Expose port and start
EXPOSE 3000

CMD ["npm", "start"]
