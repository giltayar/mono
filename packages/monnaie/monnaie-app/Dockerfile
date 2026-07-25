FROM node:26-slim

# Update system packages to patch vulnerabilities
RUN apt update -y && apt upgrade -y

# Add Tini
RUN apt install tini -y
ENTRYPOINT ["/usr/bin/tini", "--"]

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=secret,id=npmrc,target=.npmrc pnpm install --frozen-lockfile --prod
RUN pnpm cache clean

# Copy application files
COPY . .

# Run the app
ENV NODE_ENV=production

CMD ["node", "./src/app/index.ts"]
