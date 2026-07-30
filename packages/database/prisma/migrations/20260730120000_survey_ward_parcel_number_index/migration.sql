-- Composite index for QC ward queue ordering and parcel search within a ward
CREATE INDEX "surveys_wardId_parcelNumber_idx" ON "surveys"("wardId", "parcelNumber");
