import { ApiPropertyOptional } from "@nestjs/swagger"
import { IsOptional, IsString } from "class-validator"
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto.js"

export class PortalSurveyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: "Ward id; must belong to the keyed ULB" })
  @IsOptional()
  @IsString()
  wardId?: string
}
