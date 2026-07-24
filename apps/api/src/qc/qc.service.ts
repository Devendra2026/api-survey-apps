import { BadRequestException, ForbiddenException, Injectable, Logger } from "@nestjs/common"
import { PERMISSIONS } from "../common/constants/permissions.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { canAccessTenant, resolveTenantScope } from "../common/utils/tenant-scope.util.js"
import { StorageService } from "../storage/storage.service.js"
import { refreshSurveyPhotoUrls } from "../surveys/survey-photo-urls.js"
import { mapSurveyToDetailsDto } from "../surveys/survey-view.mapper.js"
import { SurveysRepository } from "../surveys/surveys.repository.js"
import { SurveysService } from "../surveys/surveys.service.js"
import type { QcFiltersDto } from "./dto/qc-filters.dto.js"
import type { QcRegistryQueryDto } from "./dto/qc-registry.dto.js"
import type { QcSurveyActionDto, QcSurveyCorrectionDto } from "./dto/qc-survey-action.dto.js"
import { mapQcEditable, type QcSurveyDetailDto } from "./qc-survey.mapper.js"
import { QcRepository } from "./qc.repository.js"

@Injectable()
export class QcService {
  private readonly logger = new Logger(QcService.name)

  constructor(
    private readonly qcRepository: QcRepository,
    private readonly surveysService: SurveysService,
    private readonly surveysRepository: SurveysRepository,
    private readonly storageService: StorageService
  ) {}

  getMetrics(filters: QcFiltersDto, user: AuthenticatedUser) {
    return this.qcRepository.getMetrics(user, filters)
  }

  getWards(filters: QcFiltersDto, user: AuthenticatedUser) {
    return this.qcRepository.getWards(user, filters)
  }

  listRegistry(query: QcRegistryQueryDto, user: AuthenticatedUser) {
    return this.qcRepository.listRegistry(user, query)
  }

  async getSurveyDetail(id: string, user: AuthenticatedUser): Promise<QcSurveyDetailDto> {
    const found = await this.surveysRepository.findById(id, user)
    const row = await this.surveysService.ensureFormulaPropertyId(found)
    const detail: QcSurveyDetailDto = {
      ...mapSurveyToDetailsDto(row),
      editable: mapQcEditable(row),
      stateName: row.state?.name,
    }
    return refreshSurveyPhotoUrls(this.storageService, detail, row.photos, this.logger)
  }

  getAuditHistory(id: string, user: AuthenticatedUser) {
    return this.surveysService.getAuditHistory(id, user)
  }

  async runSurveyAction(id: string, dto: QcSurveyActionDto, user: AuthenticatedUser) {
    const survey = await this.surveysRepository.findById(id, user)

    switch (dto.action) {
      case "approve":
        return this.surveysService.approve(survey.id, user)
      case "reject": {
        if (!dto.qcRemarks?.trim()) {
          throw new BadRequestException("QC remarks are required when returning a survey")
        }
        return this.surveysService.reject(survey.id, { qcRemarks: dto.qcRemarks.trim() }, user)
      }
      case "delete":
        if (!user.permissions.includes(PERMISSIONS.SURVEY_DELETE)) {
          throw new ForbiddenException("Missing permission: survey:delete")
        }
        return this.qcRepository.qcSoftDelete(survey.id, user.id)
      case "reopen":
        return this.qcReopen(survey.id, survey.surveyStatus, user)
      case "correct": {
        if (!dto.patch) {
          throw new BadRequestException("Correction patch is required for correct action")
        }
        await this.assertCorrectionScope(survey, dto.patch, user)
        const updated = await this.qcRepository.qcCorrectSurvey(survey.id, dto.patch, user.id)
        const detail: QcSurveyDetailDto = {
          ...mapSurveyToDetailsDto(updated),
          editable: mapQcEditable(updated),
          stateName: updated.state?.name,
        }
        return refreshSurveyPhotoUrls(this.storageService, detail, updated.photos, this.logger)
      }
      default:
        throw new BadRequestException(`Unsupported QC action: ${dto.action as string}`)
    }
  }

  private async assertCorrectionScope(
    survey: { stateId: string; districtId: string; ulbId: string; wardId: string },
    patch: QcSurveyCorrectionDto,
    user: AuthenticatedUser
  ) {
    const nextGeo = {
      stateId: patch.stateId ?? survey.stateId,
      districtId: patch.districtId ?? survey.districtId,
      ulbId: patch.ulbId ?? survey.ulbId,
      wardId: patch.wardId ?? survey.wardId,
    }
    if (patch.stateId || patch.districtId || patch.ulbId || patch.wardId) {
      const scope = resolveTenantScope(user.tenantRoles)
      if (!canAccessTenant(scope, nextGeo)) {
        throw new ForbiddenException("Cannot move survey outside your tenant scope")
      }
      await this.surveysService.assertGeoHierarchyForQc(nextGeo)
    }
  }

  private async qcReopen(id: string, surveyStatus: string, user: AuthenticatedUser) {
    if (surveyStatus === "APPROVED") {
      const { survey } = await this.surveysRepository.transitionStatus({
        id,
        from: "APPROVED",
        to: "SUBMITTED",
        changedBy: user.id,
        action: "qc.reopened",
        extra: {
          approvedAt: null,
          rejectedAt: null,
          qcRemarks: null,
          qcStatus: "PENDING",
        },
        auditNew: {
          surveyStatus: "SUBMITTED",
          qcStatus: "PENDING",
        },
      })
      return survey
    }

    if (surveyStatus === "REJECTED") {
      return this.surveysService.reopen(id, user)
    }

    throw new BadRequestException("Only APPROVED or REJECTED surveys can be reopened for QC review")
  }
}
