import { Injectable } from "@nestjs/common"
import type { AuthenticatedUser } from "../common/interfaces/authenticated-user.interface.js"
import { CommandCenterRepository } from "./command-center.repository.js"
import type { CommandCenterFiltersDto } from "./dto/command-center-filters.dto.js"

@Injectable()
export class CommandCenterService {
  constructor(private readonly commandCenterRepository: CommandCenterRepository) {}

  getAggregatedKPIs(filters: CommandCenterFiltersDto, user: AuthenticatedUser) {
    return this.commandCenterRepository.getKpis(user, filters)
  }

  getWardWiseData(filters: CommandCenterFiltersDto, user: AuthenticatedUser) {
    return this.commandCenterRepository.getWards(user, filters)
  }
}
