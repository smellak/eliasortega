FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate resolve --applied 20251028223225_init 2>/dev/null; npx prisma migrate resolve --applied 20251029000000_full_schema 2>/dev/null; npx prisma migrate resolve --applied 20260224000000_add_slot_override_source 2>/dev/null; npx prisma migrate resolve --applied 20260224100000_add_slot_override_date_range 2>/dev/null; npx prisma migrate deploy && node dist/index.js"]
