import { describe, expect, it } from "@jest/globals"
import { once } from "node:events"
import { createRequire } from "node:module"
import type { AddressInfo } from "node:net"
import { TRAEFIK_TRUST_PROXY } from "./trust-proxy.js"

const require = createRequire(import.meta.url)
const express = require(
  require.resolve("express", {
    paths: [require.resolve("@nestjs/platform-express/package.json")],
  })
) as typeof import("express")

async function withServer(trust: string | boolean, run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express()
  app.set("trust proxy", trust)
  app.get("/ip", (req, res) => {
    res.json({ ip: req.ip })
  })
  const server = app.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as AddressInfo
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  }
}

describe("TRAEFIK_TRUST_PROXY", () => {
  it("trusts only private-network peers and is not the boolean true", () => {
    expect(TRAEFIK_TRUST_PROXY).toBe("loopback, linklocal, uniquelocal")
    expect(TRAEFIK_TRUST_PROXY).not.toBe("true")
  })

  it("reads the client from X-Forwarded-For when the peer is loopback, as Traefik is on a private network", async () => {
    await withServer(TRAEFIK_TRUST_PROXY, async (baseUrl) => {
      const first = await fetch(`${baseUrl}/ip`, { headers: { "x-forwarded-for": "203.0.113.10" } })
      const second = await fetch(`${baseUrl}/ip`, { headers: { "x-forwarded-for": "203.0.113.11" } })
      expect(((await first.json()) as { ip: string }).ip).toBe("203.0.113.10")
      expect(((await second.json()) as { ip: string }).ip).toBe("203.0.113.11")
    })
  })

  it("ignores X-Forwarded-For when the proxy is not trusted", async () => {
    await withServer(false, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ip`, { headers: { "x-forwarded-for": "203.0.113.10" } })
      const body = (await response.json()) as { ip: string }
      expect(body.ip).not.toBe("203.0.113.10")
    })
  })
})
