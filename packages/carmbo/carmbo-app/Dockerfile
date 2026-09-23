FROM node:26.9-slim

# Update system packages to patch vulnerabilities
RUN apt update -y && apt upgrade -y

# Add runtime tools
RUN apt install curl postgresql-client tini -y
ENTRYPOINT ["/usr/bin/tini", "--"]

# Install Sentry CLI
RUN curl https://cli.sentry.dev/install -fsS | bash
ENV PATH="/root/.local/bin:${PATH}"

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

RUN pwd #
RUN mkdir -p /db-backup

# install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=secret,id=npmrc,target=.npmrc pnpm install --frozen-lockfile --prod
RUN pnpm store prune && pnpm cache delete

# Copy application files
COPY . .
COPY dist ./

# Run the job
ENV NODE_ENV=production

CMD ["node", "--import", "./src/app/sentry-instrument.ts", "./src/app/index.ts"]
