import { Module } from "@nestjs/common"
import { SurveysModule } from "../surveys/surveys.module.js"
import { PhotosController } from "./photos.controller.js"
import { PhotosRepository } from "./photos.repository.js"
import { PhotosService } from "./photos.service.js"

@Module({
  imports: [SurveysModule],
  controllers: [PhotosController],
  providers: [PhotosService, PhotosRepository],
  exports: [PhotosService],
})
export class PhotosModule {}
