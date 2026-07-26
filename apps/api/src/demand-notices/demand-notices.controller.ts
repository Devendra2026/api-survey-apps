import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger"
import { PERMISSIONS } from "../common/constants/permissions.js"
import { CurrentUser } from "../common/decorators/current-user.decorator.js"
import { Public } from "../common/decorators/public.decorator.js"
import { RequirePermission } from "../common/decorators/require-permission.decorator.js"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { DemandNoticesService } from "./demand-notices.service.js"
import { DemandNoticeListQueryDto, DemandNoticePrintTokenDto } from "./dto/demand-notice.dto.js"

@ApiTags("demand-notices")
@Controller("demand-notices")
export class DemandNoticesController {
  constructor(private readonly demandNoticesService: DemandNoticesService) {}

  @Get()
  @ApiBearerAuth()
  @RequirePermission(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: "List QC-APPROVED demand notices (register)" })
  list(@Query() query: DemandNoticeListQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.demandNoticesService.list(query, user)
  }

  @Post("print-token")
  @ApiBearerAuth()
  @RequirePermission(PERMISSIONS.REPORT_EXPORT)
  @ApiOperation({ summary: "Mint short-lived HMAC token for print/PDF routes" })
  printToken(@Body() dto: DemandNoticePrintTokenDto, @CurrentUser() user: AuthenticatedUser) {
    return this.demandNoticesService.mintPrintToken(dto, user)
  }

  @Public()
  @Get("print/document/:surveyId")
  @ApiOperation({ summary: "Public print document by HMAC token" })
  getPrintDocument(@Param("surveyId") surveyId: string, @Query("token") token: string) {
    return this.demandNoticesService.getDocumentByPrintToken(surveyId, token)
  }

  @Public()
  @Get("print/ward")
  @ApiOperation({ summary: "Public ward print documents by HMAC token" })
  getPrintWard(
    @Query("wardId") wardId: string,
    @Query("token") token: string,
    @Query("assessmentYearId") assessmentYearId?: string
  ) {
    return this.demandNoticesService.listWardDocumentsByPrintToken(wardId, assessmentYearId, token)
  }

  @Get(":surveyId")
  @ApiBearerAuth()
  @RequirePermission(PERMISSIONS.REPORT_VIEW)
  @ApiOperation({ summary: "Get one demand notice document (APPROVED only)" })
  getOne(@Param("surveyId") surveyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.demandNoticesService.getDocument(surveyId, user)
  }
}
