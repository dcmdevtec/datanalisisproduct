# Builder stage
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build:safe

# Prune development dependencies
RUN npm prune --production

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
