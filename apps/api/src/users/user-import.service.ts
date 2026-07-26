import { BadRequestException, Injectable } from "@nestjs/common"
import ExcelJS from "exceljs"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { UserUpsertService } from "./user-upsert.service.js"

const MAX_IMPORT_ROWS = 5_000

export type UserImportRowPreview = {
  rowNumber: number
  email: string
  clerkUserId?: string
  fullName?: string
  phone?: string
  roleName?: string
  status: "ok" | "warn" | "error"
  action: "create" | "update" | "skip"
  message: string
  warnings: string[]
}

export type UserImportResult = {
  dryRun: boolean
  created: number
  updated: number
  skipped: number
  errors: number
  rows: UserImportRowPreview[]
}

type ParsedRow = {
  rowNumber: number
  email: string
  clerkUserId?: string
  fullName?: string
  phone?: string
  roleName?: string
}

@Injectable()
export class UserImportService {
  constructor(private readonly userUpsert: UserUpsertService) {}

  getTemplateCsv(): string {
    return [
      "id,email,first_name,last_name,phone_number,role",
      "user_xxxxxxxx,jane.doe@example.com,Jane,Doe,+919876543210,SURVEYOR",
      ",pending.only@example.com,Pending,User,,",
    ].join("\n")
  }

  async importFile(
    file: Express.Multer.File | undefined,
    actor: AuthenticatedUser,
    options: { dryRun: boolean }
  ): Promise<UserImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("File is required")
    }

    const name = (file.originalname ?? "").toLowerCase()
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      throw new BadRequestException("Only .csv and .xlsx files are supported")
    }

    const parsed = name.endsWith(".csv") ? this.parseCsv(file.buffer) : await this.parseXlsx(file.buffer)

    if (parsed.length === 0) {
      throw new BadRequestException("No data rows found in file")
    }
    if (parsed.length > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`Import limited to ${MAX_IMPORT_ROWS} rows per request (got ${parsed.length})`)
    }

    const rows: UserImportRowPreview[] = []
    let created = 0
    let updated = 0
    let skipped = 0
    let errors = 0

    for (const row of parsed) {
      if (!row.email) {
        rows.push({
          rowNumber: row.rowNumber,
          email: "",
          status: "error",
          action: "skip",
          message: "Missing email",
          warnings: [],
        })
        errors += 1
        skipped += 1
        continue
      }

      const preview = await this.userUpsert.preview({
        email: row.email,
        clerkUserId: row.clerkUserId,
        fullName: row.fullName,
        phone: row.phone,
        roleName: row.roleName,
        source: "file-import",
        actor,
      })

      const previewRow: UserImportRowPreview = {
        rowNumber: row.rowNumber,
        email: row.email,
        clerkUserId: row.clerkUserId,
        fullName: row.fullName,
        phone: row.phone,
        roleName: row.roleName,
        status: preview.status,
        action: preview.action,
        message: preview.message,
        warnings: preview.warnings,
      }

      if (options.dryRun) {
        if (preview.status === "error") {
          errors += 1
          skipped += 1
        } else if (preview.action === "create") created += 1
        else updated += 1
        rows.push(previewRow)
        continue
      }

      if (preview.status === "error") {
        errors += 1
        skipped += 1
        rows.push({ ...previewRow, action: "skip" })
        continue
      }

      try {
        const result = await this.userUpsert.upsert({
          email: row.email,
          clerkUserId: row.clerkUserId,
          fullName: row.fullName,
          phone: row.phone,
          roleName: row.roleName,
          source: "file-import",
          actor,
        })
        if (result.action === "created") created += 1
        else updated += 1
        rows.push({
          ...previewRow,
          status: result.warnings.length ? "warn" : "ok",
          action: result.action === "created" ? "create" : "update",
          message: result.action === "created" ? "Created" : "Updated",
          warnings: [...preview.warnings, ...result.warnings],
          clerkUserId: result.clerkUserId,
        })
      } catch (err) {
        errors += 1
        skipped += 1
        rows.push({
          ...previewRow,
          status: "error",
          action: "skip",
          message: err instanceof Error ? err.message : "Import failed",
        })
      }
    }

    return { dryRun: options.dryRun, created, updated, skipped, errors, rows }
  }

  private parseCsv(buffer: Buffer): ParsedRow[] {
    const text = buffer.toString("utf8").replace(/^\uFEFF/, "")
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (lines.length < 2) return []

    const headers = this.splitCsvLine(lines[0]!).map((h) => this.normalizeHeader(h))
    const rows: ParsedRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const cols = this.splitCsvLine(lines[i]!)
      const record = this.rowFromRecord(headers, cols, i + 1)
      if (record) rows.push(record)
    }
    return rows
  }

  private async parseXlsx(buffer: Buffer): Promise<ParsedRow[]> {
    const workbook = new ExcelJS.Workbook()
    // exceljs typings expect ArrayBuffer-like; Node Buffer is accepted at runtime
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer)
    const sheet = workbook.worksheets[0]
    if (!sheet) return []

    const headerRow = sheet.getRow(1)
    const headers: string[] = []
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = this.normalizeHeader(String(cell.text ?? cell.value ?? ""))
    })

    const rows: ParsedRow[] = []
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return
      const cols: string[] = []
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cols[colNumber - 1] = String(cell.text ?? cell.value ?? "").trim()
      })
      const record = this.rowFromRecord(headers, cols, rowNumber)
      if (record) rows.push(record)
    })
    return rows
  }

  private rowFromRecord(headers: string[], cols: string[], rowNumber: number): ParsedRow | null {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const idx = headers.indexOf(key)
        if (idx >= 0) {
          const value = cols[idx]?.trim()
          if (value) return value
        }
      }
      return undefined
    }

    const email = get("email", "email_address", "primary_email_address")
    const first = get("first_name", "firstname", "first")
    const last = get("last_name", "lastname", "last")
    const fullFromParts = [first, last].filter(Boolean).join(" ").trim()
    const fullName = get("full_name", "fullname", "name") ?? (fullFromParts || undefined)
    const clerkUserId = get("id", "clerk_user_id", "clerkuserid", "user_id")
    const phone = get("phone_number", "phone", "mobile", "primary_phone_number")
    const roleName = get("role", "rolename", "role_name")

    // Skip completely empty rows
    if (!email && !clerkUserId && !fullName && !phone && !roleName) return null

    return {
      rowNumber,
      email: email ?? "",
      clerkUserId,
      fullName,
      phone,
      roleName,
    }
  }

  private normalizeHeader(header: string): string {
    return header
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
  }

  private splitCsvLine(line: string): string[] {
    const result: string[] = []
    let current = ""
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }
      if (ch === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
        continue
      }
      current += ch
    }
    result.push(current.trim())
    return result
  }
}
