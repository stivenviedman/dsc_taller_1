FROM node:20 AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Disable TS type checking during next build
ENV NEXT_DISABLE_TYPECHECKING=true

RUN npm run build


# -----------------------
# 2. Runner stage
# -----------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Copy only what we need from the builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Next.js production server
CMD ["npm", "start"]
