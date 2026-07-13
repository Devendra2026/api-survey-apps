import { Global, Module } from "@nestjs/common"
import { TenantScopeService } from "./services/tenant-scope.service.js"

@Global()
@Module({
  providers: [TenantScopeService],
  exports: [TenantScopeService],
})
export class CommonModule {}
