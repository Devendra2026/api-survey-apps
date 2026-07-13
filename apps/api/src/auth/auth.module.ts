import { Module } from "@nestjs/common"
import { ClerkAuthGuard } from "../common/guards/clerk-auth.guard.js"
import { PermissionsGuard } from "../common/guards/permissions.guard.js"
import { RolesGuard } from "../common/guards/roles.guard.js"
import { TenantGuard } from "../common/guards/tenant.guard.js"

@Module({
  providers: [ClerkAuthGuard, PermissionsGuard, RolesGuard, TenantGuard],
  exports: [ClerkAuthGuard, PermissionsGuard, RolesGuard, TenantGuard],
})
export class AuthModule {}
