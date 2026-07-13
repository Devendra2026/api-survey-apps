import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { OwnershipType, PhotoType, SurveyStatus } from "@workspace/database"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { PrismaService } from "../prisma/prisma.service.js"
import type { CreateSurveyDto, RejectSurveyDto, SurveyQueryDto, UpdateSurveyDto } from "./dto/survey.dto.js"
import { SurveysRepository } from "./surveys.repository.js"

const EDITABLE: SurveyStatus[] = ["DRAFT", "IN_PROGRESS", "REOPENED"]

@Injectable()
export class SurveysService {
  private readonly logger = new Logger(SurveysService.name)

  constructor(
    private readonly surveysRepository: SurveysRepository,
    private readonly prisma: PrismaService
  ) {}

  findAll(query: SurveyQueryDto, user: AuthenticatedUser) {
    return this.surveysRepository.findAll(query, user)
  }

  findById(id: string, user: AuthenticatedUser) {
    return this.surveysRepository.findById(id, user)
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
    await this.assertGeoHierarchy(dto)

    try {
      const survey = await this.surveysRepository.createWithAudit({ ...dto, createdById: user.id }, user.id)
      this.logger.log(`Survey created ${survey.id} by ${user.id}`)
      return survey
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002") {
        throw new BadRequestException("Property ID must be unique")
      }
      throw err
    }
  }

  async update(id: string, dto: UpdateSurveyDto, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)

    if (survey.createdById !== user.id) {
      throw new ForbiddenException("Only the creator can edit this survey")
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
    this.logger.log(`Survey soft-delete ${id} by ${user.id}`)
    return this.surveysRepository.softDelete(id, user.id)
  }

  async restore(id: string, user: AuthenticatedUser) {
    this.logger.log(`Survey restore ${id} by ${user.id}`)
    return this.surveysRepository.restore(id, user)
  }

  async submit(id: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)

    if (survey.createdById !== user.id) {
      throw new ForbiddenException("Only the creator can submit this survey")
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
    if (!survey.gpsCoordinates) {
      throw new BadRequestException("Survey requires GPS coordinates")
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
    if (survey.createdById === user.id) {
      throw new ForbiddenException("Creators cannot approve their own surveys")
    }

    const { survey: updated } = await this.surveysRepository.transitionStatus({
      id,
      from: "SUBMITTED",
      to: "APPROVED",
      changedBy: user.id,
      action: "APPROVED",
      extra: { approvedAt: new Date(), rejectedAt: null, qcRemarks: null },
    })
    this.logger.log(`Survey status APPROVED ${id}`)
    return updated
  }

  async reject(id: string, dto: RejectSurveyDto, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)
    if (survey.surveyStatus !== "SUBMITTED") {
      throw new BadRequestException("Only SUBMITTED surveys can be rejected")
    }
    if (survey.createdById === user.id) {
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
      },
      auditNew: { surveyStatus: "REJECTED", qcRemarks: dto.qcRemarks },
    })
    this.logger.log(`Survey status REJECTED ${id}`)
    return updated
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
    await this.surveysRepository.findById(id, user)
    return this.surveysRepository.listAudits(id)
  }

  /** Tenant-scoped read for child modules */
  async assertReadableSurvey(surveyId: string, user: AuthenticatedUser) {
    return this.surveysRepository.findById(surveyId, user)
  }

  /** Shared helper for child modules */
  async assertEditableSurvey(surveyId: string, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(surveyId, user)
    if (
      survey.surveyStatus === "APPROVED" ||
      survey.surveyStatus === "SUBMITTED" ||
      survey.surveyStatus === "REJECTED"
    ) {
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
}
