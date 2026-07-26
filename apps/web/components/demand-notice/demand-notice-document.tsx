import { buildStaticMapUrl, formatLatLong } from "@/lib/demand-notice/static-map"
import { formatInr, pctLabel, type DemandNoticeDocument } from "@/lib/demand-notice/types"
import { MapPin } from "lucide-react"

function Field({ labelEn, labelHi, value, span }: { labelEn: string; labelHi: string; value: string; span?: boolean }) {
  return (
    <div className={span ? "col-span-2" : undefined}>
      <div className="border-b border-slate-200 bg-slate-100 px-2 py-1">
        <p className="text-[9px] font-semibold tracking-wide text-slate-500 uppercase">{labelEn}</p>
        <p className="text-[8px] text-slate-400">{labelHi}</p>
      </div>
      <p className="px-2 py-1.5 text-[11px] font-semibold text-slate-900">{value || "—"}</p>
    </div>
  )
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-center">
      <p className="text-[9px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-0.5 text-xs font-bold break-all text-slate-900">{value}</p>
    </div>
  )
}

function GisMapPanel({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const coords = formatLatLong(latitude, longitude)
  const hasCoords = latitude != null && longitude != null
  const staticUrl = hasCoords ? buildStaticMapUrl(latitude, longitude) : null

  return (
    <div className="demand-notice-gis relative flex min-h-24 flex-col overflow-hidden rounded-sm border border-slate-300 bg-slate-800">
      <div className="relative min-h-28 flex-1">
        {staticUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staticUrl} alt={`GIS map at ${coords}`} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-slate-700 text-slate-300">
            <MapPin className="size-5 opacity-50" aria-hidden />
            <span className="text-[9px]">{hasCoords ? "Map key not configured" : "No GPS data"}</span>
          </div>
        )}
      </div>
      <div className="relative z-10 border-t border-slate-600 bg-slate-900/90 px-2 py-1">
        <p className="text-[8px] font-semibold tracking-wide text-slate-400 uppercase">LAT / LONG</p>
        <p className="font-mono text-[10px] font-semibold text-emerald-300">{coords}</p>
      </div>
    </div>
  )
}

export function DemandNoticeDocumentView({ doc, className }: { doc: DemandNoticeDocument; className?: string }) {
  const a = doc.assessment
  const propPct = pctLabel(a.propertyTaxPct)
  const waterPct = pctLabel(a.waterTaxPct)
  const drainPct = pctLabel(a.drainageTaxPct)

  return (
    <article
      className={`demand-notice-sheet bg-white text-slate-900 ${className ?? ""}`}
      data-demand-notice={doc.surveyId}
    >
      <header className="border border-slate-300 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-[#1d4ed8] bg-slate-50 text-[10px] font-bold text-[#1d4ed8]">
            GOV
          </div>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-sm font-bold text-slate-900">{doc.office.headerLine1}</p>
            <p className="text-[11px] font-medium text-slate-600">{doc.office.headerLine2}</p>
            <h1 className="mt-1 text-xl font-extrabold tracking-wide text-[#1d4ed8]">Property Tax Demand Notice</h1>
            <p className="text-sm font-semibold text-slate-700">संपत्ति कर मांग सूचना पत्र</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <MetaPill label="Assessment Year" value={doc.assessmentYearLabel} />
          <MetaPill label="Notice Date" value={doc.noticeDate} />
          <MetaPill label="Property ID" value={doc.propertyId} />
        </div>
      </header>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <section className="border border-slate-300">
          <div className="border-b border-slate-300 bg-slate-50 px-2 py-1">
            <p className="text-[10px] font-bold text-slate-800">PROPERTY SPECIFICATIONS / संपत्ति विनिर्देश</p>
          </div>
          <div className="grid grid-cols-2">
            <Field labelEn="Road Width Zone" labelHi="सड़क चौड़ाई क्षेत्र" value={doc.taxZoneLabel} />
            <Field labelEn="Ward No" labelHi="वार्ड संख्या" value={doc.wardLabel} />
            <Field
              labelEn="Annual Base Rate"
              labelHi="वार्षिक आधार दर"
              value={a.annualBaseRate != null ? `₹${a.annualBaseRate}/sqft/yr` : "—"}
            />
            <Field labelEn="Old House No" labelHi="पुराना मकान नं." value={doc.oldHouseNo} />
            <Field labelEn="GIS Parcel" labelHi="जीआईएस पार्सल" value={doc.gisParcel} />
            <Field labelEn="Property Use" labelHi="संपत्ति उपयोग" value={doc.propertyUseLabel} />
          </div>
        </section>

        <section className="border border-slate-300">
          <div className="border-b border-slate-300 bg-slate-50 px-2 py-1">
            <p className="text-[10px] font-bold text-slate-800">OWNER PROFILE / स्वामी विवरण</p>
          </div>
          <div className="grid grid-cols-2">
            <Field labelEn="Property Owner Name" labelHi="स्वामी का नाम" value={doc.ownerName} span />
            <Field labelEn="Father/Husband Name" labelHi="पिता/पति का नाम" value={doc.fatherName} span />
            <Field labelEn="Mobile Number" labelHi="मोबाइल नंबर" value={doc.mobileNo} span />
            <Field labelEn="Address" labelHi="पता" value={doc.address} span />
          </div>
        </section>
      </div>

      <section className="mt-2 border border-slate-300">
        <div className="border-b border-slate-300 bg-slate-50 px-2 py-1">
          <p className="text-[10px] font-bold text-slate-800">
            SITE IMAGERY & GIS MAP / स्थल चित्र एवं जीआईएस मानचित्र
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 p-2">
          <div className="grid grid-cols-2 gap-1">
            <div className="flex aspect-4/3 items-center justify-center overflow-hidden border border-slate-200 bg-slate-100">
              {doc.frontPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.frontPhotoUrl} alt="Front" className="size-full object-cover" />
              ) : (
                <span className="text-[9px] text-slate-400">Front</span>
              )}
            </div>
            <div className="flex aspect-4/3 items-center justify-center overflow-hidden border border-slate-200 bg-slate-100">
              {doc.sidePhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.sidePhotoUrl} alt="Side" className="size-full object-cover" />
              ) : (
                <span className="text-[9px] text-slate-400">Side</span>
              )}
            </div>
          </div>
          <GisMapPanel latitude={doc.latitude} longitude={doc.longitude} />
        </div>
      </section>

      <section className="mt-2 border border-slate-300">
        <div className="border-b border-slate-300 bg-slate-50 px-2 py-1">
          <p className="text-[10px] font-bold text-slate-800">
            ASSESSMENT & ALV CALCULATION DETAILS / मूल्यांकन एवं वार्षिक मूल्यांकन विवरण
          </p>
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border border-slate-200 px-1 py-1">S.NO</th>
              <th className="border border-slate-200 px-1 py-1">FLOOR</th>
              <th className="border border-slate-200 px-1 py-1">USAGE TYPE</th>
              <th className="border border-slate-200 px-1 py-1">USAGE FACTOR</th>
              <th className="border border-slate-200 px-1 py-1">CONSTRUCTION</th>
              <th className="border border-slate-200 px-1 py-1 text-right">AREA</th>
              <th className="border border-slate-200 px-1 py-1 text-right">RATE</th>
              <th className="border border-slate-200 px-1 py-1 text-right">ALV</th>
              <th className="border border-slate-200 px-1 py-1 text-right">TAX</th>
            </tr>
          </thead>
          <tbody>
            {a.floorRows.map((row) => (
              <tr key={row.sno}>
                <td className="border border-slate-200 px-1 py-1">{row.sno}</td>
                <td className="border border-slate-200 px-1 py-1">{row.floorLabel}</td>
                <td className="border border-slate-200 px-1 py-1">{row.usageTypeLabel}</td>
                <td className="border border-slate-200 px-1 py-1">{row.usageFactorLabel}</td>
                <td className="border border-slate-200 px-1 py-1">{row.constructionLabel}</td>
                <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">{row.areaSqFt.toFixed(2)}</td>
                <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">
                  {row.annualRate.toFixed(2)}
                </td>
                <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">{row.alv.toFixed(2)}</td>
                <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">{row.tax.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className="border border-slate-200 px-1 py-1" colSpan={5}>
                TOTAL
              </td>
              <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">{a.totalArea.toFixed(2)}</td>
              <td className="border border-slate-200 px-1 py-1" />
              <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">{a.totalAlv.toFixed(2)}</td>
              <td className="border border-slate-200 px-1 py-1 text-right tabular-nums">{a.propertyTax.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        {a.rateMissing ? <p className="px-2 py-1 text-[10px] font-medium text-red-600">{a.rateMissingReason}</p> : null}
      </section>

      <div className="mt-2 grid grid-cols-4 gap-2">
        <div className="rounded-md border border-slate-300 px-2 py-2 text-center">
          <p className="text-[9px] font-semibold text-slate-500">PROPERTY TAX ({propPct})</p>
          <p className="text-sm font-bold tabular-nums">{formatInr(a.propertyTax)}</p>
        </div>
        <div className="rounded-md border border-slate-300 px-2 py-2 text-center">
          <p className="text-[9px] font-semibold text-slate-500">WATER TAX ({waterPct})</p>
          <p className="text-sm font-bold tabular-nums">{formatInr(a.waterTax)}</p>
        </div>
        <div className="rounded-md border border-slate-300 px-2 py-2 text-center">
          <p className="text-[9px] font-semibold text-slate-500">DRAINAGE TAX ({drainPct})</p>
          <p className="text-sm font-bold tabular-nums">{formatInr(a.drainageTax)}</p>
        </div>
        <div className="rounded-md border-2 border-emerald-600 bg-emerald-50 px-2 py-2 text-center">
          <p className="text-[9px] font-semibold text-emerald-800">TOTAL DEMAND</p>
          <p className="text-sm font-extrabold text-emerald-700 tabular-nums">{formatInr(a.totalAnnualDemand)}</p>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] gap-4 border border-slate-300 p-2">
        <div>
          <p className="text-[10px] font-bold text-slate-800">IMPORTANT NOTICE / महत्वपूर्ण सूचना</p>
          <p className="mt-1 text-[9px] leading-snug text-slate-700">{doc.legalHindi}</p>
        </div>
        <div className="flex min-w-28 flex-col items-end justify-end text-right">
          <p className="text-xs font-semibold text-slate-700">Sd/-</p>
          <div className="mt-4 w-full border-t-2 border-[#1d4ed8]" />
          <p className="mt-1 text-[10px] font-bold text-slate-900">EXECUTIVE OFFICER</p>
          <p className="text-[9px] text-slate-600">अधिशासी अधिकारी</p>
        </div>
      </div>
    </article>
  )
}
