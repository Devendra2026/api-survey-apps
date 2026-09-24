import { Global, Module } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { PublicStorageController } from "./public-storage.controller.js"
import { createStorageService } from "./storage.factory.js"
import { StorageService } from "./storage.service.js"
import { STORAGE_SERVICE } from "./storage.types.js"

@Global()
@Module({
  controllers: [PublicStorageController],
  providers: [
    {
      provide: STORAGE_SERVICE,
      inject: [ConfigService],
      useFactory: createStorageService,
    },
    StorageService,
  ],
  exports: [STORAGE_SERVICE, StorageService],
})
export class StorageModule {}
