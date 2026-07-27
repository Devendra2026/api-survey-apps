# Cost optimization notes

Baseline with **Dokploy + Docker Postgres/MinIO/Redis** on a single VM: cost is mostly the host size and disk, not managed AWS data services.

## Highest cost drivers

1. Dokploy EC2 / VPS size (CPU/RAM for api + Playwright worker + web)
2. Disk for Postgres + MinIO volumes (photo-heavy workloads)
3. Egress / bandwidth from the host
4. Optional ECR storage + CI minutes

## Safe optimizations

| Action                                                                       | When                      |
| ---------------------------------------------------------------------------- | ------------------------- |
| Right-size the Dokploy host after observing CPU/RAM under peak survey upload | After 1–2 weeks           |
| Cap MinIO / Postgres disk with monitoring + cleanup of failed imports        | Ongoing                   |
| Keep Redis AOF; rely on Postgres for durable job metadata                    | Day-1                     |
| Optional ECR only when multi-host or faster deploys matter                   | After first stable launch |
| Split worker to a second host if Playwright OOMs web/api                     | Observed OOM              |

## Scaling triggers

| Signal                | Action                                                   |
| --------------------- | -------------------------------------------------------- |
| API p95 latency / 5xx | Upsize host or add another Dokploy node                  |
| Postgres disk > 70%   | Expand volume; archive old exports                       |
| MinIO disk > 70%      | Expand volume; lifecycle old ETL images if policy allows |
| Worker queue lag      | Increase worker concurrency or dedicated worker host     |
| Export OOM            | Lower export batch size or larger worker host            |
