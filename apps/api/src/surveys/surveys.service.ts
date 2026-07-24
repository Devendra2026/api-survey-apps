import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { ExportFormat, JobStatus, OwnershipType, PhotoType, SurveyStatus } from "@workspace/database"
import { formatPropertyId } from "@workspace/validation"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope, userHasPermissionInTenant } from "../common/utils/tenant-scope.util.js"
import { JobsService } from "../jobs/jobs.service.js"
import { PrismaService } from "../prisma/prisma.service.js"
import { StorageService } from "../storage/storage.service.js"
import { getDemoAuditHistory, getDemoSurveyDetails, isDemoSurveyPropertyId } from "./demo-survey-view.data.js"
import type {
  BulkExportSurveysDto,
  BulkRejectSurveysDto,
  BulkSurveyIdsDto,
  CreateSurveyDto,
  RejectSurveyDto,
  SurveyQueryDto,
  UpdateSurveyDto,
  WardStatsQueryDto,
} from "./dto/survey.dto.js"
import { refreshSurveyPhotoUrls } from "./survey-photo-urls.js"
import { mapAuditsToHistoryDto, mapSurveyToDetailsDto } from "./survey-view.mapper.js"
import { SurveysRepository } from "./surveys.repository.js"

const EDITABLE: SurveyStatus[] = ["DRAFT", "IN_PROGRESS", "REOPENED"]

type BulkItemResult = { id: string; reason: string }

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name)

  constructor(
    private readonly surveysRepository: SurveysRepository,
    private readonly prisma: PrismaService,
    private readonly jobsService: JobsService,
    private readonly storageService: StorageService
  ) {}

  findAll(query: SurveyQueryDto, user: AuthenticatedUser) {
    return this.surveysRepository.findAll(query, user)
  }

  wardCommandStats(query: WardStatsQueryDto, user: AuthenticatedUser) {
    return this.surveysRepository.wardCommandStats(user, {
      limit: query.limit,
      districtId: query.districtId,
      ulbId: query.ulbId,
    })
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.surveysRepository.findById(id, user)
  }

  async getSurveyDetails(idOrPropertyId: string, user: AuthenticatedUser) {
    if (isDemoSurveyPropertyId(idOrPropertyId)) {
      return getDemoSurveyDetails()
    }
    let survey = await this.surveysRepository.findById(idOrPropertyId, user)
    survey = await this.ensureFormulaPropertyId(survey)
    const detail = mapSurveyToDetailsDto(survey)
    return refreshSurveyPhotoUrls(this.storageService, detail, survey.photos, this.logger)
  }

  /** Replace legacy TEMP-* Property IDs with formula when ULB/Ward/Parcel/Unit/Use are present. */
  async ensureFormulaPropertyId<
    T extends {
      id: string
      propertyId: string
      ulbCode: string | null
      wardNumber: string | null
      parcelNumber: string | null
      unitSubNo: string | null
      propertyUse: string | null
    },
  >(survey: T): Promise<T> {
    if (!survey.propertyId.startsWith("TEMP-")) return survey
    if (!survey.ulbCode || !survey.wardNumber || !survey.parcelNumber || !survey.unitSubNo || !survey.propertyUse) {
      return survey
    }
    const derived = formatPropertyId({
      ulbCode: survey.ulbCode,
      wardNo: survey.wardNumber,
      parcelNo: survey.parcelNumber,
      unitNo: survey.unitSubNo,
      propertyUse: survey.propertyUse,
    })
    if (!derived || derived === survey.propertyId) return survey
    try {
      await this.prisma.db.survey.update({
        where: { id: survey.id },
        data: { propertyId: derived },
      })
      return { ...survey, propertyId: derived }
    } catch (err) {
      this.logger.warn(`Could not upgrade TEMP propertyId for survey=${survey.id}: ${String(err)}`)
      return survey
    }
  }

  async getAuditHistory(idOrPropertyId: string, user: AuthenticatedUser) {
    if (isDemoSurveyPropertyId(idOrPropertyId)) {
      return getDemoAuditHistory()
    }
    const survey = await this.surveysRepository.findById(idOrPropertyId, user)
    const audits = await this.surveysRepository.listAudits(survey.id)
    return mapAuditsToHistoryDto(survey.propertyId, audits)
  }

  async create(dto: CreateSurveyDto, user: AuthenticatedUser) {
    const scope = resolveTenantScope(user.tenantRoles)
    if (
      !canAccessTenant(scope, {
        stateId: dto.stateId,
        districtId: dto.districtId,
        ulbId: dto.ulbId,
        wardId: dto.wardId,
      })
    ) {
      throw new ForbiddenException("Cannot create survey outside your tenant scope")
    }
    if (
      !userHasPermissionInTenant(user, "survey:create", {
        stateId: dto.stateId,
        districtId: dto.districtId,
        ulbId: dto.ulbId,
        wardId: dto.wardId,
      })
    ) {
      throw new ForbiddenException("Missing permission survey:create in this tenant scope")
    }
    await this.assertGeoHierarchy(dto)

    try {
      const survey = await this.surveysRepository.createWithAudit(
        { ...dto, createdById: user.id, assignedToId: user.id, assignedAt: new Date() },
        user.id
      )
      this.logger.log(`Survey created ${survey.id} by ${user.id}`)
      return survey
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        throw new BadRequestException("Property ID must be unique within ULB and assessment year")
      }
      throw err
    }
  }

  async update(id: string, dto: UpdateSurveyDto, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)

    if (survey.createdById !== user.id && survey.assignedToId !== user.id) {
      throw new ForbiddenException("Only the creator or assignee can edit this survey")
    }
    if (!EDITABLE.includes(survey.surveyStatus)) {
      throw new BadRequestException(`Survey in status ${survey.surveyStatus} cannot be edited`)
    }

    const nextGeo = {
      stateId: dto.stateId ?? survey.stateId,
      districtId: dto.districtId ?? survey.districtId,
      ulbId: dto.ulbId ?? survey.ulbId,
      wardId: dto.wardId ?? survey.wardId,
    }
    if (dto.stateId || dto.districtId || dto.ulbId || dto.wardId) {
      const scope = resolveTenantScope(user.tenantRoles)
      if (!canAccessTenant(scope, nextGeo)) {
        throw new ForbiddenException("Cannot move survey outside your tenant scope")
      }
      await this.assertGeoHierarchy(nextGeo)
    }

    const nextStatus = survey.surveyStatus === "DRAFT" ? ("IN_PROGRESS" as const) : undefined

    const updated = await this.surveysRepository.update(id, dto)
    if (nextStatus) {
      await this.surveysRepository.transitionStatus({
        id,
        from: survey.surveyStatus,
        to: nextStatus,
        changedBy: user.id,
        action: "STATUS_IN_PROGRESS",
      })
      return this.surveysRepository.findById(id, user)
    }
    return updated
  }

  async softDelete(id: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)
    if (survey.surveyStatus === "APPROVED") {
      throw new BadRequestException("Approved surveys cannot be soft-deleted")
    }
    if (survey.surveyStatus === "SUBMITTED") {
      throw new BadRequestException(
        "Submitted surveys cannot be deleted from the Survey Module. Use the QC Module (Admin) instead."
      )
    }
    this.logger.log(`Survey soft-delete ${id} by ${user.id}`)
    return this.surveysRepository.softDelete(id, user.id)
  }

  async restore(id: string, user: AuthenticatedUser) {
    this.logger.log(`Survey restore ${id} by ${user.id}`)
    return this.surveysRepository.restore(id, user)
  }

  async submit(id: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)

    if (survey.createdById !== user.id && survey.assignedToId !== user.id) {
      throw new ForbiddenException("Only the creator or assignee can submit this survey")
    }
    if (!EDITABLE.includes(survey.surveyStatus)) {
      throw new BadRequestException(`Cannot submit survey in status ${survey.surveyStatus}`)
    }

    if (!survey.floors.length) {
      throw new BadRequestException("Survey requires at least one floor")
    }
    if (!survey.photos.some((p) => p.photoType === PhotoType.FRONT)) {
      throw new BadRequestException("Survey requires at least one FRONT photo")
    }
    if (survey.latitude == null || survey.longitude == null) {
      throw new BadRequestException("Survey requires GPS latitude and longitude")
    }
    if (!survey.propertyId || !survey.ownershipType || !survey.propertyUse || !survey.propertyType) {
      throw new BadRequestException("Survey requires valid property details")
    }
    if (survey.ownershipType === OwnershipType.JOINT && survey.coOwners.length === 0) {
      throw new BadRequestException("JOINT ownership requires at least one co-owner")
    }

    const { survey: updated } = await this.surveysRepository.transitionStatus({
      id,
      from: survey.surveyStatus,
      to: "SUBMITTED",
      changedBy: user.id,
      action: "SUBMITTED",
      extra: {
        submittedAt: new Date(),
        rejectedAt: null,
        qcRemarks: null,
        qcStatus: "PENDING",
      },
    })
    this.logger.log(`Survey status SUBMITTED ${id}`)
    return updated
  }

  async approve(id: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)
    if (survey.surveyStatus !== "SUBMITTED") {
      throw new BadRequestException("Only SUBMITTED surveys can be approved")
    }
    const isAdmin = user.tenantRoles.some((r) => r.isActive && r.roleName === "ADMIN")
    if (survey.createdById === user.id && !isAdmin) {
      throw new ForbiddenException("Creators cannot approve their own surveys")
    }

    const { survey: updated } = await this.surveysRepository.transitionStatus({
      id,
      from: "SUBMITTED",
      to: "APPROVED",
      changedBy: user.id,
      action: "APPROVED",
      extra: {
        approvedAt: new Date(),
        rejectedAt: null,
        qcRemarks: null,
        qcStatus: "APPROVED",
      },
      auditNew: { surveyStatus: "APPROVED", qcStatus: "APPROVED" },
    })
    this.logger.log(`Survey status APPROVED ${id}`)
    return updated
  }

  async reject(id: string, dto: RejectSurveyDto, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)
    if (survey.surveyStatus !== "SUBMITTED") {
      throw new BadRequestException("Only SUBMITTED surveys can be rejected")
    }
    const isAdmin = user.tenantRoles.some((r) => r.isActive && r.roleName === "ADMIN")
    if (survey.createdById === user.id && !isAdmin) {
      throw new ForbiddenException("Creators cannot reject their own surveys")
    }

    const { survey: updated } = await this.surveysRepository.transitionStatus({
      id,
      from: "SUBMITTED",
      to: "REJECTED",
      changedBy: user.id,
      action: "REJECTED",
      extra: {
        rejectedAt: new Date(),
        qcRemarks: dto.qcRemarks,
        qcStatus: "REJECTED",
      },
      auditNew: { surveyStatus: "REJECTED", qcStatus: "REJECTED", qcRemarks: dto.qcRemarks },
    })
    this.logger.log(`Survey status REJECTED ${id}`)
    return updated
  }

  async bulkApprove(dto: BulkSurveyIdsDto, user: AuthenticatedUser) {
    const succeeded: string[] = []
    const failed: BulkItemResult[] = []

    for (const id of dto.ids) {
      try {
        await this.approve(id, user)
        succeeded.push(id)
      } catch (error: unknown) {
        failed.push({ id, reason: this.errorMessage(error) })
      }
    }

    await this.prisma.db.securityAudit.create({
      data: {
        action: "SURVEY_BULK_APPROVE",
        actorId: user.id,
        targetType: "Survey",
        targetId: succeeded[0] ?? dto.ids[0] ?? "none",
        metadata: {
          requested: dto.ids.length,
          succeeded,
          failed,
        },
      },
    })

    this.logger.log(`Bulk approve by ${user.id}: ${succeeded.length}/${dto.ids.length}`)
    return { succeeded, failed }
  }

  async bulkReject(dto: BulkRejectSurveysDto, user: AuthenticatedUser) {
    const succeeded: string[] = []
    const failed: BulkItemResult[] = []

    for (const id of dto.ids) {
      try {
        await this.reject(id, { qcRemarks: dto.qcRemarks }, user)
        succeeded.push(id)
      } catch (error: unknown) {
        failed.push({ id, reason: this.errorMessage(error) })
      }
    }

    await this.prisma.db.securityAudit.create({
      data: {
        action: "SURVEY_BULK_REJECT",
        actorId: user.id,
        targetType: "Survey",
        targetId: succeeded[0] ?? dto.ids[0] ?? "none",
        metadata: {
          requested: dto.ids.length,
          qcRemarks: dto.qcRemarks,
          succeeded,
          failed,
        },
      },
    })

    this.logger.log(`Bulk reject by ${user.id}: ${succeeded.length}/${dto.ids.length}`)
    return { succeeded, failed }
  }

  async bulkExport(dto: BulkExportSurveysDto, user: AuthenticatedUser) {
    const accessible = await this.surveysRepository.findAccessibleByIds(dto.selectedIds, user)
    const accessibleIds = accessible.map((s) => s.id)
    if (accessibleIds.length === 0) {
      throw new BadRequestException("No accessible surveys found for export")
    }

    const reportType = dto.reportType ?? "survey_data"
    const filters = { selectedIds: accessibleIds }
    const job = await this.prisma.db.exportJob.create({
      data: {
        createdById: user.id,
        reportType,
        format: ExportFormat.XLSX,
        filters,
      },
      select: { id: true, status: true },
    })

    await this.jobsService.enqueueExport({
      jobId: job.id,
      createdById: user.id,
      format: "xlsx",
      reportType,
      filters,
      tenantRoles: user.tenantRoles,
    })

    await this.prisma.db.securityAudit.create({
      data: {
        action: "SURVEY_BULK_EXPORT",
        actorId: user.id,
        targetType: "ExportJob",
        targetId: job.id,
        metadata: {
          reportType,
          selectedCount: accessibleIds.length,
          skippedCount: dto.selectedIds.length - accessibleIds.length,
        },
      },
    })

    return { jobId: job.id, status: JobStatus.QUEUED, selectedCount: accessibleIds.length }
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return "Unknown error"
  }

  async reopen(id: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)
    if (survey.surveyStatus !== "REJECTED") {
      throw new BadRequestException("Only REJECTED surveys can be reopened")
    }
    if (survey.createdById !== user.id && !user.permissions.includes("survey:update")) {
      throw new ForbiddenException("Not allowed to reopen this survey")
    }

    const { survey: updated } = await this.surveysRepository.transitionStatus({
      id,
      from: "REJECTED",
      to: "REOPENED",
      changedBy: user.id,
      action: "REOPENED",
    })
    this.logger.log(`Survey status REOPENED ${id}`)
    return updated
  }

  async history(id: string, user: AuthenticatedUser) {
    return this.getAuditHistory(id, user)
  }

  async assign(id: string, assigneeId: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)
    if (!EDITABLE.includes(survey.surveyStatus)) {
      throw new BadRequestException(`Cannot assign survey in status ${survey.surveyStatus}`)
    }

    const geo = {
      stateId: survey.stateId,
      districtId: survey.districtId,
      ulbId: survey.ulbId,
      wardId: survey.wardId,
    }

    if (!userHasPermissionInTenant(user, "survey:assign", geo)) {
      throw new ForbiddenException("Missing permission survey:assign in this tenant scope")
    }

    const assignee = await this.prisma.db.user.findUnique({
      where: { id: assigneeId },
      include: {
        tenantRoles: { where: { isActive: true }, include: { role: true } },
      },
    })
    if (!assignee || !assignee.isActive) {
      throw new BadRequestException("Assignee must be an active user")
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
    if (!canAccessTenant(assigneeScope, geo)) {
      throw new ForbiddenException("Assignee does not belong to the survey tenant scope")
    }

    if (assigneeId === survey.assignedToId) {
      throw new BadRequestException("Survey is already assigned to this user")
    }

    const assigned = await this.surveysRepository.assignSurvey({
      id,
      assigneeId,
      changedBy: user.id,
      previousAssigneeId: survey.assignedToId ?? survey.createdById,
    })
    this.logger.log(`Survey assigned ${id} to ${assigneeId} by ${user.id}`)
    return assigned
  }

  /** Tenant-scoped read for child modules */
  async assertReadableSurvey(surveyId: string, user: AuthenticatedUser) {
    return this.surveysRepository.findById(surveyId, user)
  }

  /** Shared helper for child modules (photos, floors). QC approvers may edit non-APPROVED surveys. */
  async assertEditableSurvey(surveyId: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(surveyId, user)
    const canQcEdit = user.permissions.includes("survey:approve")

    if (survey.surveyStatus === "APPROVED") {
      throw new BadRequestException("Survey cannot be modified in current status")
    }

    if (canQcEdit) {
      return survey
    }

    if (survey.surveyStatus === "SUBMITTED" || survey.surveyStatus === "REJECTED") {
      throw new BadRequestException("Survey cannot be modified in current status")
    }
    if (survey.createdById !== user.id && !user.permissions.includes("survey:update")) {
      throw new ForbiddenException("Not allowed to modify this survey")
    }
    return survey
  }

  async getSurveyOrFail(surveyId: string) {
    const survey = await this.surveysRepository.findByIdRaw(surveyId)
    if (!survey) throw new NotFoundException("Survey not found")
    return survey
  }

  private async assertGeoHierarchy(geo: { stateId: string; districtId: string; ulbId: string; wardId: string }) {
    const ward = await this.prisma.db.ward.findUnique({
      where: { id: geo.wardId },
      include: {
        ulb: { include: { district: true } },
      },
    })
    if (!ward) throw new BadRequestException("Invalid wardId")
    if (ward.ulbId !== geo.ulbId) {
      throw new BadRequestException("wardId does not belong to ulbId")
    }
    if (ward.ulb.districtId !== geo.districtId) {
      throw new BadRequestException("ulbId does not belong to districtId")
    }
    if (ward.ulb.district.stateId !== geo.stateId) {
      throw new BadRequestException("districtId does not belong to stateId")
    }
  }

  /** Public wrapper for QC / customer modules that need hierarchy validation. */
  async assertGeoHierarchyForQc(geo: { stateId: string; districtId: string; ulbId: string; wardId: string }) {
    return this.assertGeoHierarchy(geo)
  }
}
