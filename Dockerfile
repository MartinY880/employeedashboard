# ─── Stage 1: Install dependencies ───────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# ─── Stage 2: Build ─────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Logto env vars must be present at build time so Next.js
# inlines the correct values into the server bundle.
ARG LOGTO_ENDPOINT
ARG LOGTO_APP_ID
ARG LOGTO_APP_SECRET
ARG LOGTO_COOKIE_SECRET
ARG LOGTO_BASE_URL
ARG LOGTO_API_RESOURCE

ENV LOGTO_ENDPOINT=$LOGTO_ENDPOINT
ENV LOGTO_APP_ID=$LOGTO_APP_ID
ENV LOGTO_APP_SECRET=$LOGTO_APP_SECRET
ENV LOGTO_COOKIE_SECRET=$LOGTO_COOKIE_SECRET
ENV LOGTO_BASE_URL=$LOGTO_BASE_URL
ENV LOGTO_API_RESOURCE=$LOGTO_API_RESOURCE

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (standalone output)
RUN npm run build

# ─── Stage 3: Production runner ─────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Install Prisma CLI globally and psql client for data seeding
RUN npm install -g prisma@latest && \
    apk add --no-cache postgresql-client

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Remove prisma.config.ts that standalone copies (it needs dotenv which isn't available)
# Write a minimal production config, and symlink global prisma so require() finds it
RUN rm -f prisma.config.ts prisma.config.js && \
    GLOBAL_PREFIX=$(npm prefix -g) && \
    ln -sf "$GLOBAL_PREFIX/lib/node_modules/prisma" node_modules/prisma && \
    echo "const{defineConfig}=require('prisma/config');module.exports=defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations'},datasource:{url:process.env.DATABASE_URL}});" > prisma.config.js

# Copy Prisma schema + migrations for deploy
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy entrypoint script
COPY docker-entrypoint.sh ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Wait for DB, run migrations, then start the server
ENTRYPOINT ["sh", "docker-entrypoint.sh"]
