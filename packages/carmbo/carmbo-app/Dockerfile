FROM node:24.4-alpine

# Update system packages to patch vulnerabilities
RUN apk update && apk upgrade

# Add Tini
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

RUN pwd #

# install dependencies
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=secret,id=npmrc,target=.npmrc pnpm install --frozen-lockfile --prod
RUN pnpm cache clean

# Copy application files
COPY . .
COPY dist ./

# Run the job
ENV NODE_ENV=production

CMD ["node", "./src/app/index.ts"]
