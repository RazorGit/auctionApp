#
# Webapp container (Node.js + Angular)
#
# This repository currently only contains `spec.md`. Once you add your Angular
# project files (e.g. `package.json`, `angular.json`, `src/`), this Dockerfile
# will work as-is for a dev container.
#
# Typical usage (dev):
#   docker build -t webapp .
#   docker run --rm -it -p 4200:4200 -v "$PWD":/app webapp
#

FROM node:20-bookworm-slim

WORKDIR /app

COPY . .

# Install dependencies if/when an app exists in this repo.
# (Avoid failing the build when this repo only contains `spec.md`.)
RUN if [ -f package.json ]; then npm ci; fi

EXPOSE 4200

# Prefer the local CLI via npm scripts.
# Expected scripts in package.json:
#   "start": "ng serve --host 0.0.0.0 --port 4200"
CMD [ "bash", "-lc", "if [ -f package.json ]; then npm run start; else echo 'No package.json found. Add your Angular app and re-build.'; sleep infinity; fi" ]
