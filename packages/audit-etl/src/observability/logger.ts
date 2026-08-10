export type LogLevel = "info" | "warn" | "error"

export interface StructuredLogFields {
  msg: string
  [key: string]: unknown
}

function emit(level: LogLevel, fields: StructuredLogFields): void {
  const line = JSON.stringify({
    level,
    ts: new Date().toISOString(),
    ...fields,
  })
  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.info(line)
  }
}

export const auditEtlLogger = {
  info(fields: StructuredLogFields): void {
    emit("info", fields)
  },
  warn(fields: StructuredLogFields): void {
    emit("warn", fields)
  },
  error(fields: StructuredLogFields): void {
    emit("error", fields)
  },
}
