/** Re-export shared tax helpers (moved to @workspace/validation). */
export {
  computeDemandTotals,
  computeExportTaxSummary,
  computeFloorAlv,
  formatAmountPlain,
  formatAssessmentYearLabel,
  formatNoticeDate,
  humanizeEnum,
  resolveUsageRateMult,
  roundMoney,
  taxRateKey,
  toTaxNumber,
  type ExportTaxFloorInput,
  type ExportTaxRateTable,
  type ExportTaxSummary,
} from "@workspace/validation"
