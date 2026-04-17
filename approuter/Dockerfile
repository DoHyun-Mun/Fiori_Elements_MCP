# Approuter Dockerfile for IAS OIDC Authentication
FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY xs-app.json ./

ENV PORT=5000

EXPOSE 5000

# non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup
USER appuser

CMD ["npm", "start"]