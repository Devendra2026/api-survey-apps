import { Injectable } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service.js"

@Injectable()
export class ConfigurationGeographyService {
  constructor(private readonly prisma: PrismaService) {}

  async getTree(stateId?: string) {
    const states = await this.prisma.db.state.findMany({
      where: stateId ? { id: stateId } : undefined,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { districts: true, surveys: true } },
        districts: {
          orderBy: { name: "asc" },
          include: {
            _count: { select: { ulbs: true, surveys: true } },
            ulbs: {
              orderBy: { name: "asc" },
              include: {
                _count: { select: { wards: true, surveys: true } },
                wards: {
                  orderBy: { wardNumber: "asc" },
                  include: {
                    _count: { select: { surveys: true, taxConfigs: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    return states.map((state) => ({
      id: state.id,
      type: "state" as const,
      name: state.name,
      code: state.code,
      status: state.status,
      counts: {
        districts: state._count.districts,
        surveys: state._count.surveys,
      },
      children: state.districts.map((district) => ({
        id: district.id,
        type: "district" as const,
        name: district.name,
        status: district.status,
        parentId: state.id,
        counts: {
          ulbs: district._count.ulbs,
          surveys: district._count.surveys,
        },
        children: district.ulbs.map((ulb) => ({
          id: ulb.id,
          type: "ulb" as const,
          name: ulb.name,
          code: ulb.code,
          ulbType: ulb.type,
          status: ulb.status,
          parentId: district.id,
          counts: {
            wards: ulb._count.wards,
            surveys: ulb._count.surveys,
          },
          children: ulb.wards.map((ward) => ({
            id: ward.id,
            type: "ward" as const,
            name: ward.wardName,
            wardNumber: ward.wardNumber,
            status: ward.status,
            parentId: ulb.id,
            counts: {
              surveys: ward._count.surveys,
              taxConfigs: ward._count.taxConfigs,
            },
          })),
        })),
      })),
    }))
  }
}
