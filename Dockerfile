FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto-core \
    fonts-noto-extra \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /home/node/app
RUN chown node:node /home/node/app

COPY --chown=node:node package.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
USER node
RUN npm install

COPY --chown=node:node . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=7860
ENV CHROME_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 7860

CMD ["npm", "start"]
