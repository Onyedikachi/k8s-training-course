# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---------- runtime stage ----------
FROM node:22-alpine
ARG APP_VERSION=1.0.0
ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    PORT=3000
WORKDIR /app
# group 0 ownership + numeric non-root UID: works on AKS (runAsNonRoot) and on OpenShift (arbitrary UID in group 0)
COPY --from=build --chown=1001:0 /app/node_modules ./node_modules
COPY --from=build --chown=1001:0 /app/dist ./dist
COPY --chown=1001:0 package.json ./
USER 1001
EXPOSE 3000
CMD ["node", "dist/main"]
