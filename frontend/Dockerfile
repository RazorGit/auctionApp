FROM node:20-bookworm-slim AS build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Angular "application" builder outputs to dist/<app>/browser
COPY --from=build /app/dist/webapp/browser /usr/share/nginx/html
COPY --from=build /app/dist/webapp/3rdpartylicenses.txt /usr/share/nginx/html/3rdpartylicenses.txt

