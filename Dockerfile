# -------------------------------
# 1️⃣ Etapa de construcción
# -------------------------------
FROM node:20-alpine AS builder

# Configurar el directorio de trabajo
WORKDIR /app

# Copiar dependencias primero
COPY package*.json ./

# Instalar dependencias
RUN npm install --frozen-lockfile

# Copiar el resto del código
COPY . .

# Compilar la aplicación
RUN npm run build

# -------------------------------
# 2️⃣ Etapa de ejecución
# -------------------------------
FROM node:20-alpine

WORKDIR /app

# Copiar los artefactos construidos desde la etapa anterior
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.js ./next.config.js

# Exponer el puerto que Dokku usará
EXPOSE 3000

# Comando de inicio
CMD ["npm", "start"]
