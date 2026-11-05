import { afterAll, beforeAll, describe, expect, it } from "@jest/globals"
import { Controller, type INestApplication, Post, UploadedFile, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { Test } from "@nestjs/testing"
import { memoryStorage } from "multer"
import type { Server } from "node:http"
import request from "supertest"

/**
 * Guards the multer override (pnpm-workspace.yaml) used by @nestjs/platform-express:
 * same interceptor options as photos.controller.ts must still parse files and enforce the size limit.
 */
@Controller("t")
class UploadProbeController {
  @Post("upload")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 1024 } }))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { name: file.originalname, size: file.size, mime: file.mimetype, isBuffer: Buffer.isBuffer(file.buffer) }
  }
}

describe("multipart upload pipeline", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [UploadProbeController] }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it("parses a file into memory", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/t/upload")
      .attach("file", Buffer.alloc(512, 1), { filename: "a.jpg", contentType: "image/jpeg" })
    expect(res.status).toBe(201)
    expect(res.body).toEqual({ name: "a.jpg", size: 512, mime: "image/jpeg", isBuffer: true })
  })

  it("rejects files over the configured limit with 413", async () => {
    const res = await request(app.getHttpServer() as Server)
      .post("/t/upload")
      .attach("file", Buffer.alloc(4096, 1), { filename: "big.jpg", contentType: "image/jpeg" })
    expect(res.status).toBe(413)
  })
})
