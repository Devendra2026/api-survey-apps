import { createPrismaClient } from "./src/client.js"

const prisma = createPrismaClient()
try {
  const cols = await prisma.$queryRaw<Array<{ column_name: string; data_type: string; is_nullable: string }>>`
    select column_name, data_type, is_nullable from information_schema.columns
    where table_name = 'qc_remarks' and column_name in ('section', 'field', 'reason') order by column_name`
  console.log("columns", cols)
  const survey = await prisma.survey.findFirst({
    where: { deletedAt: null },
    include: {
      qcRemarkThread: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { author: { select: { id: true, fullName: true } } },
      },
    },
  })
  console.log("survey findFirst with qcRemarkThread ok", {
    found: Boolean(survey),
    remarks: survey?.qcRemarkThread.length ?? 0,
  })
  console.log("qc_remarks rows", await prisma.qcRemark.count())
} finally {
  await prisma.$disconnect()
}
