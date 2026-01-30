# HTTPS Integration Implementation Plan (Saved for Later)

Enabling HTTPS is essential for security and modern web features (like clipboard access, geolocation, etc.). This plan covers two scenarios: local development and production.

## User Review Required

> [!IMPORTANT]
> For **Local Development**, we will use a self-signed certificate. Browsers will show a warning (e.g., "Your connection is not private") which you'll need to bypass by clicking "Advanced" -> "Proceed to localhost".
> 
> For **Production**, you should use a proper Certificate Authority (like Let's Encrypt). This implementation plan focuses on the structural changes needed to support SSL in Docker/Nginx.

## Proposed Changes

### 1. Certificate Management
- **Local**: Generate a self-signed certificate using `openssl`.

[Creating certificate reference](https://www.google.com/search?q=generating+a+certificate+using+openssl&oq=generating+a+certificate+using+openssl&gs_lcrp=EgZjaHJvbWUyBggAEEUYOTIICAEQABgWGB4yCAgCEAAYFhgeMggIAxAAGBYYHjIICAQQABgWGB4yCAgFEAAYFhgeMggIBhAAGBYYHjIICAcQABgWGB4yCAgIEAAYFhgeMggICRAAGBYYHtIBCTEwODI1ajBqN6gCALACAA&sourceid=chrome&ie=UTF-8)

- **Production**: Map a volume for Certbot/Let's Encrypt certificates.

### 2. Frontend Configuration
#### [MODIFY] [nginx.conf](file:///Users/fredames/Docker/webapp/frontend/nginx.conf)
- Add a new `server` block listening on port 443 with `ssl`.
- Update port 80 to redirect to port 443.
- Configure SSL certificate paths.

### 3. Infrastructure
#### [MODIFY] [docker-compose.yml](file:///Users/fredames/Docker/webapp/docker-compose.yml)
- Map port `443:443` on the `web` service.
- Add a volume to mount the certificates into `/etc/nginx/ssl`.

## Verification Plan

### Manual Verification
1.  Navigate to `https://localhost:4200` (or `https://localhost`).
2.  Confirm the browser shows the SSL padlock (even if it says "untrusted" for self-signed).
3.  Verify the application still functions correctly and proxies API requests as before.
4.  Confirm `http://localhost:4200` correctly redirects to `https`.
