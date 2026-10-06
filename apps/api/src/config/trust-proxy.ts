/**
 * Express `trust proxy` value for this deployment.
 *
 * Dokploy and Swarm publish the API only through Traefik. Traefik connects to the
 * container over a private Docker network (`dokploy-network` / `traefik-public`).
 * Forwarded client addresses are honored only when that immediate peer is loopback,
 * link-local, or RFC1918 (`uniquelocal`). A client that can reach the process directly
 * cannot spoof `X-Forwarded-For`.
 *
 * Do not set this to `true`: that trusts every peer and collapses every surveyor
 * into one throttle bucket when the header is missing or forged.
 */
export const TRAEFIK_TRUST_PROXY = "loopback, linklocal, uniquelocal"
