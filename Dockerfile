# ============================
# 🧱 Builder stage
# ============================
FROM node:20-alpine AS builder
WORKDIR /app

ENV NEXT_PRIVATE_DISABLE_WEBPACK_CACHE=1
ENV NEXT_PRIVATE_SKIP_CLOUD_CACHE=1
ENV DISABLE_V8_COMPILE_CACHE=1
ENV NODE_OPTIONS="--max_old_space_size=512"

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN if [ -f .env.production ]; then echo ".env.production found"; else echo "" > .env.production; fi

# Usa el nuevo script build:safe
RUN npm run build:safe

RUN npm prune --production


# ============================
# 🚀 Runner stage
# ============================
FROM node:20-alpine AS runner
WORKDIR /app

COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .

RUN npm ci --omit=dev

COPY --from=builder /app/.next .next
COPY --from=builder /app/public public
COPY --from=builder /app/next.config.mjs .

COPY --from=builder /app/.env.production .env.production

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
