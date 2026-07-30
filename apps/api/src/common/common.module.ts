import { Global, Module } from "@nestjs/common"
import { AccessBootstrapService } from "./services/access-bootstrap.service.js"
import { RoleProvisioningService } from "./services/role-provisioning.service.js"
import { TenantScopeService } from "./services/tenant-scope.service.js"
import { WardCatalogService } from "./services/ward-catalog.service.js"

@Global()
@Module({
  providers: [TenantScopeService, RoleProvisioningService, AccessBootstrapService, WardCatalogService],
  exports: [TenantScopeService, RoleProvisioningService, WardCatalogService],
})
export class CommonModule {}
