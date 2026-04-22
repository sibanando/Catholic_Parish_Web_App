# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
# Template: nginx entrypoint substitutes ${BACKEND_HOST} at container start
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Default value — override at runtime via BACKEND_HOST env var
ENV BACKEND_HOST=backend
EXPOSE 80
