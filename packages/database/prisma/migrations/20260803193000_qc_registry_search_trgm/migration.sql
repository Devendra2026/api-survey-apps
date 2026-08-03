-- QC Registry substring search (ILIKE contains) — pg_trgm GIN indexes
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "surveys_parcelNumber_idx" ON "surveys"("parcelNumber");
CREATE INDEX "surveys_respondentName_idx" ON "surveys"("respondentName");

CREATE INDEX "surveys_propertyId_trgm_idx" ON "surveys" USING gin ("propertyId" gin_trgm_ops);
CREATE INDEX "surveys_parcelNumber_trgm_idx" ON "surveys" USING gin ("parcelNumber" gin_trgm_ops);
CREATE INDEX "surveys_respondentName_trgm_idx" ON "surveys" USING gin ("respondentName" gin_trgm_ops);
CREATE INDEX "co_owners_name_trgm_idx" ON "co_owners" USING gin ("name" gin_trgm_ops);
