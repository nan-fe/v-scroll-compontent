# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /v-scroll-compontent
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /v-scroll-compontent/dist /usr/share/nginx/html
EXPOSE 80
