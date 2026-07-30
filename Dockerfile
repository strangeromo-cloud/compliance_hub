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

# Readiness, declared rather than guessed. The gateway returns 502 for as long as
# it has no container to route to, so the swap window is exactly the time between
# the old one stopping and the new one being known-good. /health answers as soon
# as the listener is up — before boot sync finishes, which is correct: the app
# serves during sync and reports each source's state honestly.
#
# start-period covers image start; the interval is deliberately loose because
# this probe exists to establish readiness, not to poll a healthy process.
HEALTHCHECK --start-period=10s --interval=30s --timeout=4s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form, so node is PID 1 and receives SIGTERM directly. server.js installs
# an explicit handler because the kernel applies no default signal disposition
# to PID 1 — without it the container can never be stopped.
CMD ["node", "server.js"]
