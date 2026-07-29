# An explicit image instead of buildpack detection.
#
# The buildpack path produced deployments that failed with no runtime output at
# all, which is undiagnosable: nothing indicates whether the process started,
# what it bound, or why it stopped. Everything here is stated outright, so a
# failure now has to show up in the logs.
FROM node:20-alpine

WORKDIR /app

# The project has no runtime dependencies, but installing from the lockfile
# first keeps this layer cached and fails loudly if the lockfile ever drifts.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# The app falls back to this when the platform does not inject PORT.
ENV PORT=8080
EXPOSE 8080

# Exec form, so node is PID 1 and receives SIGTERM directly. server.js installs
# an explicit handler because the kernel applies no default signal disposition
# to PID 1 — without it the container can never be stopped.
CMD ["node", "server.js"]
