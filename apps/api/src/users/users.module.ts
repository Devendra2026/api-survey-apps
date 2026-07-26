import { Module } from "@nestjs/common"
import { ClerkUserSyncService } from "./clerk-user-sync.service.js"
import { UserImportService } from "./user-import.service.js"
import { UserUpsertService } from "./user-upsert.service.js"
import { UsersController } from "./users.controller.js"
import { UsersRepository } from "./users.repository.js"
import { UsersService } from "./users.service.js"

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, UserUpsertService, ClerkUserSyncService, UserImportService],
  exports: [UsersService, UsersRepository, UserUpsertService],
})
export class UsersModule {}
