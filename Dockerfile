FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build
FROM python:3.12-slim
WORKDIR /app
COPY server ./server
COPY --from=build /app/dist ./dist
RUN useradd --create-home ccq && mkdir /app/data && chown ccq:ccq /app/data
USER ccq
ENV PORT=8000
EXPOSE 8000
CMD ["python", "server/app.py"]
