FROM node:20-alpine

RUN apk --no-cache upgrade && \
    apk --no-cache add tzdata && \
    cp /usr/share/zoneinfo/Europe/Kyiv /etc/localtime && \
    echo "Europe/Kyiv" > /etc/timezone

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENTRYPOINT ["npm", "run", "start"]
