FROM oven/bun AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules node_modules
COPY . .

FROM base AS release
COPY --from=deps /app/node_modules node_modules
COPY --from=builder /app ./
ENV NODE_ENV=production
CMD ["bun", "run", "start"]

