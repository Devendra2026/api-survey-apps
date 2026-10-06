import { describe, expect, it } from "@jest/globals"
import { readClientIp, throttleTrackerKey } from "./throttle-tracker.js"

describe("throttleTrackerKey", () => {
  it("gives two authenticated surveyors separate buckets when they share a proxy IP", () => {
    const sharedProxyIp = "172.18.0.5"
    const surveyorA = throttleTrackerKey({ userId: "user-a", ip: sharedProxyIp })
    const surveyorB = throttleTrackerKey({ userId: "user-b", ip: sharedProxyIp })
    expect(surveyorA).toBe("user:user-a")
    expect(surveyorB).toBe("user:user-b")
    expect(surveyorA).not.toBe(surveyorB)
  })

  it("keeps anonymous traffic on one IP bucket", () => {
    const first = throttleTrackerKey({ userId: null, ip: "203.0.113.10" })
    const second = throttleTrackerKey({ userId: undefined, ip: "203.0.113.10" })
    expect(first).toBe("ip:203.0.113.10")
    expect(second).toBe(first)
  })

  it("does not put 100 surveyors behind Traefik into one bucket", () => {
    const traefikPeer = "172.18.0.2"
    const keys = new Set<string>()
    for (let index = 0; index < 100; index += 1) {
      keys.add(throttleTrackerKey({ userId: `surveyor-${index}`, ip: traefikPeer }))
    }
    expect(keys.size).toBe(100)
    expect(keys.has(throttleTrackerKey({ userId: null, ip: traefikPeer }))).toBe(false)
  })
})

describe("readClientIp", () => {
  it("uses the address Express resolved after trust proxy", () => {
    expect(readClientIp({ ip: "203.0.113.8" })).toBe("203.0.113.8")
    expect(readClientIp({})).toBe("unknown")
  })
})
