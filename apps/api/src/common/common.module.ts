import { Global, Module } from "@nestjs/common"
import { RoleProvisioningService } from "./services/role-provisioning.service.js"
import { TenantScopeService } from "./services/tenant-scope.service.js"

@Global()
@Module({
  providers: [TenantScopeService, RoleProvisioningService],
  exports: [TenantScopeService, RoleProvisioningService],
})
export class CommonModule {}
