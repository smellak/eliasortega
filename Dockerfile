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
COPY --from=builder /app/seed-production.cjs ./

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate resolve --applied 20251028223225_init 2>/dev/null; npx prisma migrate resolve --applied 20251029000000_full_schema 2>/dev/null; npx prisma migrate resolve --applied 20260224000000_add_slot_override_source 2>/dev/null; npx prisma migrate resolve --applied 20260224100000_add_slot_override_date_range 2>/dev/null; npx prisma migrate resolve --applied 20260225000000_add_estimated_fields_to_appointment 2>/dev/null; npx prisma migrate resolve --applied 20260226000000_add_confirmation_system 2>/dev/null; npx prisma db execute --file ./prisma/migrations/20260227000000_add_dock_system/migration.sql 2>/dev/null; npx prisma migrate resolve --applied 20260227000000_add_dock_system 2>/dev/null; npx prisma migrate deploy && (node seed-production.cjs || echo '[warn] Seed failed, continuing...') && node dist/index.js"]
