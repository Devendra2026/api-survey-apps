import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope, userHasPermissionInTenant } from "../common/utils/tenant-scope.util.js"
import { ImportsService } from "../imports/imports.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { ReassignDraftsDto, SurveyRegistryQueryDto } from "./dto/survey-registry.dto.js"
import { SurveyRegistryRepository } from "./survey-registry.repository.js"

@Injectable()
export class SurveyRegistryService {
  constructor(
    private readonly surveyRegistryRepository: SurveyRegistryRepository,
    private readonly importsService: ImportsService,
    private readonly prisma: PrismaService
  ) {}

  list(query: SurveyRegistryQueryDto, user: AuthenticatedUser) {
    return this.surveyRegistryRepository.list(user, query)
  }

  listDraftSources(query: SurveyRegistryQueryDto & { orphaned?: boolean }, user: AuthenticatedUser) {
    return this.surveyRegistryRepository.listDraftSources(user, {
      districtId: query.districtId,
      ulbId: query.ulbId,
      wardId: query.wardId,
      orphaned: query.orphaned,
    })
  }

  async importExcel(file: Express.Multer.File | undefined, user: AuthenticatedUser) {
    if (!file) throw new BadRequestException("Excel file is required")
    const result = await this.importsService.enqueueSurveyImport(file, user)
    return {
      success: true,
      importedCount: 0,
      jobId: result.jobId,
      status: result.status,
      message: "Import queued successfully",
    }
  }

  async reassignDrafts(dto: ReassignDraftsDto, user: AuthenticatedUser) {
    const toSurveyorId = dto.toSurveyorId || dto.toSurveyor
    const fromSurveyorId = dto.fromSurveyorId || dto.fromSurveyor || undefined

    if (!toSurveyorId) {
      throw new BadRequestException("Target surveyor is required")
    }
    if (fromSurveyorId && fromSurveyorId === toSurveyorId) {
      throw new BadRequestException("Source and target surveyor must be different")
    }

    const geo = {
      districtId: dto.districtId,
      ulbId: dto.ulbId,
      wardId: dto.wardId || dto.scopeId,
    }

    if (!userHasPermissionInTenant(user, "survey:assign", geo)) {
      throw new ForbiddenException("Missing permission survey:assign in this tenant scope")
    }

    const assignee = await this.prisma.db.user.findUnique({
      where: { id: toSurveyorId },
      include: {
        tenantRoles: { where: { isActive: true }, include: { role: true } },
      },
    })
    if (!assignee || !assignee.isActive) {
      throw new BadRequestException("Target surveyor must be an active user")
    }

    const assigneeScope = resolveTenantScope(
      assignee.tenantRoles.map((r) => ({
        id: r.id,
        roleId: r.roleId,
        roleName: r.role.name,
        permissions: [],
        stateId: r.stateId,
        districtId: r.districtId,
        ulbId: r.ulbId,
        wardId: r.wardId,
        isActive: r.isActive,
      }))
    )

    if ((geo.districtId || geo.ulbId || geo.wardId) && !canAccessTenant(assigneeScope, geo)) {
      throw new ForbiddenException("Target surveyor does not belong to the selected survey scope")
    }

    return this.surveyRegistryRepository.reassignDrafts(user, {
      fromSurveyorId,
      toSurveyorId,
      districtId: dto.districtId,
      ulbId: dto.ulbId,
      wardId: dto.wardId,
      scopeId: dto.scopeId,
    })
  }
}
