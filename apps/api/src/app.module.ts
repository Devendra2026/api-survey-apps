import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core"
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler"
import { AuthModule } from "./auth/auth.module.js"
import { CoOwnersModule } from "./co-owners/co-owners.module.js"
import { CommandCenterModule } from "./command-center/command-center.module.js"
import { CommonModule } from "./common/common.module.js"
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter.js"
import { ClerkAuthGuard } from "./common/guards/clerk-auth.guard.js"
import { PermissionsGuard } from "./common/guards/permissions.guard.js"
import { TenantGuard } from "./common/guards/tenant.guard.js"
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor.js"
import { ResponseTransformInterceptor } from "./common/interceptors/response-transform.interceptor.js"
import { monorepoEnvFiles } from "./config/env-files.js"
import { validateEnv } from "./config/env.validation.js"
import { DashboardModule } from "./dashboard/dashboard.module.js"
import { DemandNoticesModule } from "./demand-notices/demand-notices.module.js"
import { DistrictsModule } from "./districts/districts.module.js"
import { EtlModule } from "./etl/etl.module.js"
import { FloorsModule } from "./floors/floors.module.js"
import { HealthController } from "./health/health.controller.js"
import { ImportsModule } from "./imports/imports.module.js"
import { JobsModule } from "./jobs/jobs.module.js"
import { NotificationsModule } from "./notifications/notifications.module.js"
import { PermissionsModule } from "./permissions/permissions.module.js"
import { PhotosModule } from "./photos/photos.module.js"
import { PrismaModule } from "./prisma/prisma.module.js"
import { QcModule } from "./qc/qc.module.js"
import { ReportsModule } from "./reports/reports.module.js"
import { RolesModule } from "./roles/roles.module.js"
import { SavedViewsModule } from "./saved-views/saved-views.module.js"
import { StatesModule } from "./states/states.module.js"
import { StorageModule } from "./storage/storage.module.js"
import { SurveyAuditsModule } from "./survey-audits/survey-audits.module.js"
import { SurveyRegistryModule } from "./survey-registry/survey-registry.module.js"
import { SurveysModule } from "./surveys/surveys.module.js"
import { TaxConfigsModule } from "./tax-configs/tax-configs.module.js"
import { UlbsModule } from "./ulbs/ulbs.module.js"
import { UsersModule } from "./users/users.module.js"
import { WardsModule } from "./wards/wards.module.js"
import { ConfigAuditModule } from "./config-audit/config-audit.module.js"
import { ConfigurationModule } from "./configuration/configuration.module.js"
import { ReferenceCatalogsModule } from "./reference-catalogs/reference-catalogs.module.js"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Single source: repo-root `.env` (+ optional `.env.local` overrides)
      envFilePath: monorepoEnvFiles(),
      expandVariables: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    CommonModule,
    StorageModule,
    JobsModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    StatesModule,
    DistrictsModule,
    UlbsModule,
    WardsModule,
    ConfigAuditModule,
    ReferenceCatalogsModule,
    ConfigurationModule,
    TaxConfigsModule,
    SurveysModule,
    CommandCenterModule,
    QcModule,
    SurveyRegistryModule,
    SavedViewsModule,
    FloorsModule,
    PhotosModule,
    CoOwnersModule,
    SurveyAuditsModule,
    DashboardModule,
    ReportsModule,
    DemandNoticesModule,
    ImportsModule,
    EtlModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: ClerkAuthGuard },
    { provide: APP_GUARD, useExisting: PermissionsGuard },
    { provide: APP_GUARD, useExisting: TenantGuard },
  ],
})
export class AppModule {}
