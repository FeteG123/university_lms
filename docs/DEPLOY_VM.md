# Deploy LMS Lite on a Linux VM (course / production-style)

The rubric expects a **public URL** served by **your** stack: **Docker Compose + Traefik** on a VM (not a PaaS that hides the gateway).

---

## 1. Create the server

- **Provider:** Hetzner, DigitalOcean, AWS Lightsail/EC2, Azure VM, etc.
- **OS:** Ubuntu **22.04 LTS** or **24.04 LTS** (64-bit).
- **Size:** 2 GB RAM minimum (4 GB if you enable Grafana profile).
- **Networking:** attach a **public IPv4** (and optional IPv6).

---

## 2. Open firewall ports

On the VM (example with `ufw`):

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Optional: **do not** expose Traefik’s raw dashboard (`8080`) to the internet in production, or bind it to localhost only (see `docker-compose` comments in repo if you add an override).

---

## 3. Install Docker

Follow the official **Docker Engine** install for Ubuntu, then the **Compose plugin**:

- https://docs.docker.com/engine/install/ubuntu/

Verify:

```bash
docker --version
docker compose version
```

Add your user to the `docker` group if you want to avoid `sudo` (then re-login):

```bash
sudo usermod -aG docker "$USER"
```

---

## 4. Put the project on the VM

```bash
git clone <YOUR_REPO_URL> lms
cd lms
```

---

## 5. Traefik: allow your public hostname or IP

Edit **`infra/traefik/dynamic/routes.yml`**.

The `Host(...)` rule must include how users will open the site in the browser, for example:

- **Domain:** add `|| Host(\`lms.yourdomain.edu\`)` next to `localhost`.
- **Raw IP only:** add `|| Host(\`203.0.113.10\`)` with your VM’s IPv4.

Example (replace with your values):

```yaml
rule: Host(`localhost`) || Host(`127.0.0.1`) || Host(`lms.example.edu`)
```

If you only use an IP and no DNS name, use that IP inside `Host(\`...\`)`.

Save the file. Traefik watches this directory and will reload.

---

## 6. Configure secrets (`.env`)

```bash
cp .env.example .env
nano .env   # or vim
```

Set at least:

| Variable | Notes |
|----------|--------|
| `POSTGRES_PASSWORD` | Strong random password |
| `JWT_SECRET` | Long random string (signing keys) |
| `DATABASE_URL` | Must match Postgres user/db/password (default pattern in `.env.example` is fine if you only change password) |

Optional observability on the VM (heavier):

```env
COMPOSE_PROFILES=observability
OTEL_EXPORTER_OTLP_ENDPOINT=otel-collector:4317
OTEL_SERVICE_NAME=lms-api
```

---

## 7. Production-style compose (recommended on VM)

Dev machines use a **bind mount** so Python changes hot-reload. On a server you should run the **image** built at deploy time (no bind mount).

From the repo root:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` clears the API `volumes` overrides so `api-1` / `api-2` use only the code baked into the image.

---

## 8. First start and seed

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec -T postgres psql -U lms -d lms < scripts/seed.sql
```

(Adjust `POSTGRES_USER` / `POSTGRES_DB` if you changed them.)

---

## 9. Smoke test

- **App:** `http://YOUR_HOST_OR_IP/` (or `https://...` once TLS is configured).
- **API docs:** `http://YOUR_HOST_OR_IP/docs`
- **Health:** `http://YOUR_HOST_OR_IP/health/ready`

---

## 10. TLS (R8) — Let’s Encrypt (outline)

1. Point **DNS A record** for `lms.yourdomain.edu` → VM public IP.
2. Put that hostname in **`routes.yml`** `Host(...)`.
3. Add a Traefik **certificates resolver** (HTTP-01) in `infra/traefik/traefik.yml` and attach `tls` + `certResolver` on the router in dynamic config.

Exact YAML depends on your Traefik version and email; use Traefik v3 “Let’s Encrypt” docs and keep `websecure` entrypoint on `:443`.

Until TLS is done, serving on **port 80** is enough for a first deploy URL for `LINKS.txt`; add HTTPS before final demo if the rubric stresses R8.

---

## 11. What you submit

- **`LINKS.txt`:** public `http(s)://...` base URL (same host Traefik serves).
- **GitHub URL** with this repo.
- **`report.pdf`** with architecture, ER, BPMN, R6 numbers, R12 screenshots, etc.

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| 404 / connection reset from browser | `routes.yml` `Host(...)` does not match the **Host** header you type in the URL. |
| 502 from Traefik | `docker compose ps` — `api-1` / `api-2` **healthy**? `docker compose logs api-1`. |
| DB errors | `DATABASE_URL` matches Postgres container env; migrate ran (`lms-migrate` **Exited 0**). |
