# Étape 1 : compilation
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
# Adresse factice : prisma generate a seulement besoin que la variable existe
ENV DATABASE_URL="postgresql://x:x@localhost:5432/x"
RUN npx prisma generate && npm run build

# Étape 2 : image finale (non root)
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache openssl tzdata
ENV NODE_ENV=production
COPY --chown=node:node --from=build /app /app
RUN mkdir -p /app/storage/dossiers && chown -R node:node /app/storage
USER node
EXPOSE 3001
# 1) migrations avec le compte propriétaire, 2) l'application démarre avec le compte limité
CMD ["sh", "-c", "DATABASE_URL=\"$DATABASE_URL_MIGRATION\" npx prisma migrate deploy && npm run start:prod"]