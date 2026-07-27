# Production go-live (Dokploy + Docker Postgres/MinIO/Redis)

## What is already done in the repo

- `docker-compose.dokploy.yml` — builds web/api/worker + Docker Postgres, MinIO, Redis
- `.env.production` — domains, Clerk, Docker DB/storage URLs
- Migrations fail fast if `REPLACE_ME` is still in `DATABASE_URL`
- Release workflow can push to ECR later (optional); first launch uses compose **build**

## Blockers only you can clear

1. **Postgres + MinIO passwords** in Dokploy env  
   Set strong `POSTGRES_PASSWORD` / `MINIO_ROOT_PASSWORD` and keep them aligned with `DATABASE_URL` / `DIRECT_URL`.

2. **DNS + TLS in Dokploy**
   - `admin.sdvedutech.in` → service `web` port `3001`
   - `backend.sdvedutech.in` → service `api` port `4000`
   - Worker listens on `4001` (internal; open SG if you need direct access)
   - Clerk allowed origins / redirect URLs include `https://admin.sdvedutech.in`

3. **EC2 security group** — allow inbound TCP `3001`, `4000`, `4001` (plus `80`/`443` for the proxy):

```powershell
# Configure AWS credentials first, then:
.\scripts\ops\open-dokploy-ports.ps1
```

Or manually:

```bash
aws ec2 authorize-security-group-ingress --group-id sg-XXXXXXXX --protocol tcp --port 3001 --cidr 0.0.0.0/0 --region ap-south-1
aws ec2 authorize-security-group-ingress --group-id sg-XXXXXXXX --protocol tcp --port 4000 --cidr 0.0.0.0/0 --region ap-south-1
aws ec2 authorize-security-group-ingress --group-id sg-XXXXXXXX --protocol tcp --port 4001 --cidr 0.0.0.0/0 --region ap-south-1
```

(Previous Dokploy host SG was `sg-02d37ca2cd71ed334` on `13.127.204.141`.)

## Dokploy deploy steps

1. Paste `.env.production` into Dokploy environment (after setting strong passwords).
2. Deploy compose file `docker-compose.dokploy.yml` from this repo.
3. Wait for `postgres` / `minio` / `redis` healthy, `migrate` success, then `api` `/health` + `/ready`, then `web`.
4. Open `https://admin.sdvedutech.in` and sign in with Clerk.
5. Optional: set `BOOTSTRAP_ADMIN_CLERK_USER_IDS` to your Clerk user id, redeploy once.

## Smoke test

```bash
curl -fsS https://backend.sdvedutech.in/health
curl -fsS https://backend.sdvedutech.in/ready
curl -fsSI https://admin.sdvedutech.in/
```

## After first successful deploy

- Rotate Clerk / Maps keys that were shared earlier.
- Optional: switch images to ECR via release workflow.
- Schedule volume backups ([backup-restore.md](./backup-restore.md)).
