import { Module } from "@nestjs/common"
import { ClerkAuthGuard } from "../common/guards/clerk-auth.guard.js"
import { PermissionsGuard } from "../common/guards/permissions.guard.js"
import { TenantGuard } from "../common/guards/tenant.guard.js"

/**
 * Auth guards are provided here and registered once as APP_GUARD via useExisting
 * in AppModule so Nest does not create duplicate guard instances.
 */
@Module({
  providers: [ClerkAuthGuard, PermissionsGuard, TenantGuard],
  exports: [ClerkAuthGuard, PermissionsGuard, TenantGuard],
})
export class AuthModule {}
