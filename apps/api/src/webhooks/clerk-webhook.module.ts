import { Module } from "@nestjs/common"
import { UsersModule } from "../users/users.module.js"
import { ClerkWebhookController } from "./clerk-webhook.controller.js"
import { ClerkWebhookService } from "./clerk-webhook.service.js"

@Module({
  imports: [UsersModule],
  controllers: [ClerkWebhookController],
  providers: [ClerkWebhookService],
})
export class ClerkWebhookModule {}
