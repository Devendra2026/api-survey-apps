import { Module } from "@nestjs/common"
import { SavedViewsController } from "./saved-views.controller.js"
import { SavedViewsRepository } from "./saved-views.repository.js"
import { SavedViewsService } from "./saved-views.service.js"

@Module({
  controllers: [SavedViewsController],
  providers: [SavedViewsService, SavedViewsRepository],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}
