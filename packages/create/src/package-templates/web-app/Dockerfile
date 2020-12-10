FROM node:15
ARG NPM_FILE

ENV NODE_ENV=production

WORKDIR /app

COPY package-lock.json ./
COPY .temp/package.json ./package.json
RUN echo $NPM_FILE >.npmrc && \
    npm ci --production && \
    npm cache clear --force && rm -f .npmrc
COPY ./src .

EXPOSE 80
ENV PORT=80

CMD ["node", "run-templatetemplate.js"]
