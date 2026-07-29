### Task 3: Docker Compose and Dokploy hardening

**Files:**

- Modify: `docker-compose.dokploy.yml`
- Modify: `docker-compose.yml` (MinIO pin + docs comments only if needed)
- Modify: `deploy/docker-stack.swarm.yml` (Redis requirepass alignment **or** deprecation comment)
- Modify: `docs/ops/dokploy-compose-setup.md` if port exposure guidance changes

**Interfaces:**

- Consumes: Dockerfile ARG pins from Task 1
- Produces: Compose that validates; Traefik-primary exposure; refreshed MinIO RELEASE pins

- [ ] **Step 1: Resolve latest MinIO RELEASE tags**

```bash
# Use Docker Hub / MinIO release notes; pin matching server + mc era
```

Update in `docker-compose.dokploy.yml` (and local compose):

```yaml
image: minio/minio:RELEASE.<newest-stable>
# and
image: minio/mc:RELEASE.<matching>
```

Keep private bucket init in Dokploy (no `mc anonymous set download`).

- [ ] **Step 2: Harden published ports**

On `api`, `web`, and `worker` in `docker-compose.dokploy.yml`: remove host `ports:` mappings when Traefik labels + `dokploy-network` are present, **unless** ops docs require host health probes. If removing ports, update `docs/ops/dokploy-compose-setup.md` and `DEPLOYMENT.md` to say Traefik is the only ingress.

If host ports must remain for Dokploy health UI, leave them but add a comment that security groups must not expose `0.0.0.0/0` on 3001/4000/4001.

- [ ] **Step 3: Confirm migrate gate**

Verify `api` and `worker` still have:

```yaml
depends_on:
  migrate:
    condition: service_completed_successfully
```

and `migrate` uses `apps/api` image + `docker-entrypoint.migrate.sh`.

- [ ] **Step 4: Validate compose**

```bash
docker compose -f docker-compose.dokploy.yml config
```

Expected: exit 0; interpolated required-env placeholders fail closed when unset (document required env in examples).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.dokploy.yml docker-compose.yml deploy/docker-stack.swarm.yml docs
git commit -m "fix: harden Dokploy compose pins and Traefik exposure"
```

---
