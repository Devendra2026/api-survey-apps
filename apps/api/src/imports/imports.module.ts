import { Module } from "@nestjs/common"
import { JobsModule } from "../jobs/jobs.module.js"
import { GeoCatalogImportService } from "./geo-catalog-import.service.js"
import { ImportsController } from "./imports.controller.js"
import { ImportsService } from "./imports.service.js"

@Module({
  imports: [JobsModule],
  controllers: [ImportsController],
  providers: [ImportsService, GeoCatalogImportService],
  exports: [ImportsService, GeoCatalogImportService],
})
export class ImportsModule {}
