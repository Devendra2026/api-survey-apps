-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "tenantId" TEXT,
    "changesBefore" JSONB,
    "changesAfter" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "payloadChecksum" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_etl_cursors" (
    "id" TEXT NOT NULL,
    "pipelineKey" TEXT NOT NULL,
    "lastProcessedTimestamp" BIGINT NOT NULL DEFAULT 0,
    "lastProcessedId" TEXT NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_etl_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_etl_dlq" (
    "id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "stack" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_etl_dlq_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "audit_events_eventId_key" ON "audit_events"("eventId");

-- CreateIndex
CREATE INDEX "audit_events_tenantId_occurredAt_idx" ON "audit_events"("tenantId", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_events_action_occurredAt_idx" ON "audit_events"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "audit_events_occurredAt_idx" ON "audit_events"("occurredAt");

-- CreateIndex
CREATE INDEX "audit_events_actorId_occurredAt_idx" ON "audit_events"("actorId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_etl_cursors_pipelineKey_key" ON "audit_etl_cursors"("pipelineKey");

-- CreateIndex
CREATE INDEX "audit_etl_dlq_createdAt_idx" ON "audit_etl_dlq"("createdAt");
