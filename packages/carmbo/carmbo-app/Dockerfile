FROM node:24.11-slim

# Update system packages to patch vulnerabilities
RUN apt update -y && apt upgrade -y

# Add Tini
RUN apt install tini -y
ENTRYPOINT ["/usr/bin/tini", "--"]

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
