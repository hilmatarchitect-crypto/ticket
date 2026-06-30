FROM mcr.microsoft.com/playwright:v1.53.2-noble

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends fonts-noto-core fonts-noto-extra \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=10000

EXPOSE 10000

CMD ["npm", "start"]
