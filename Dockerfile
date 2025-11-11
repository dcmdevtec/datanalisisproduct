# ============================
# 🧱 Builder stage
# ============================
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .


COPY .env.production .env.production

# ✅ Construir usando las variables del .env.production
RUN npm run build:safe

RUN npm prune --production


# ============================
# 🚀 Runner stage
# ============================
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/.env.production ./.env.production

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
