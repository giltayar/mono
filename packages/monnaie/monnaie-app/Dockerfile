# --- dependencies -------------------------------------------------------------
FROM node:26-alpine AS deps

RUN npm install -g pnpm

WORKDIR /app

# install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=secret,id=npmrc,target=.npmrc pnpm install --frozen-lockfile --prod

# --- runtime ------------------------------------------------------------------
FROM node:26-alpine

# Update system packages to patch vulnerabilities, and add Tini
RUN apk upgrade --no-cache && apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

# The only remaining CVEs in this image come from the dependencies bundled inside
# npm, which is never used at runtime (pnpm only runs in the `deps` stage).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY . .

# Run the app
ENV NODE_ENV=production

USER node

CMD ["node", "./src/app/index.ts"]
