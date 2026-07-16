"use client"

import { GisMap } from "@/components/shared/gis-map"
import {
  glassInsetClass,
  glassPanelClass,
  statusBadgeClass,
  SurveyViewField,
} from "@/components/surveys/survey-view-field"
import type { SurveyAuditHistoryItem, SurveyDetails, SurveyFloorRow, SurveyOwnerRow } from "@/lib/api/types"
import type { ColumnDef } from "@tanstack/react-table"
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from "@tanstack/react-table"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { cn } from "@workspace/ui/lib/utils"
import { ArrowLeft, ImageIcon } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

function GlassSection({
  title,
  subtitle,
  children,
  className,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn(glassPanelClass, "overflow-hidden", className)}>
      <div className="border-b border-white/30 px-5 py-4 dark:border-white/10">
        <h2 className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-50">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  )
}

function GlassTable<T>({ columns, data, empty }: { columns: ColumnDef<T>[]; data: T[]; empty: string }) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (!data.length) {
    return (
      <div className={cn(glassInsetClass, "px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400")}>
        {empty}
      </div>
    )
  }

  return (
    <div className={cn(glassInsetClass, "overflow-x-auto")}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className="border-white/30 bg-white/30 hover:bg-white/30 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/5"
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className="h-10 text-[10px] font-semibold tracking-[0.12em] text-slate-500 uppercase dark:text-slate-400"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="border-white/20 hover:bg-white/25 dark:border-white/5 dark:hover:bg-white/5"
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className="py-3 text-sm text-slate-800 dark:text-slate-100">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SurveyPhotoCard({ label, url, caption }: { label: string; url: string; caption: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/40 bg-white/30 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-white/5">
      {failed ? (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
          <ImageIcon className="size-8 opacity-50" />
          <span className="text-xs">Image unavailable</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- external/demo photo URLs
        <img
          src={url}
          alt={label}
          onError={() => setFailed(true)}
          className="aspect-video w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/80 via-slate-950/40 to-transparent p-4 text-white">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs text-white/85">{caption}</p>
      </div>
    </div>
  )
}

export function SurveyViewContent({ survey, audits }: { survey: SurveyDetails; audits: SurveyAuditHistoryItem[] }) {
  const ownerColumns = useMemo<ColumnDef<SurveyOwnerRow>[]>(
    () => [
      { accessorKey: "propertyId", header: "Property ID" },
      { accessorKey: "name", header: "Name" },
      { accessorKey: "fatherHusband", header: "Father/Husband" },
      { accessorKey: "mobile", header: "Mobile" },
      { accessorKey: "altMobile", header: "Alt Mobile" },
    ],
    []
  )

  const floorColumns = useMemo<ColumnDef<SurveyFloorRow>[]>(
    () => [
      { accessorKey: "sNo", header: "S. No." },
      { accessorKey: "floor", header: "Floor" },
      { accessorKey: "usageType", header: "Usage Type" },
      { accessorKey: "usageFactor", header: "Usage Factor" },
      { accessorKey: "construction", header: "Construction" },
      { accessorKey: "area", header: "Area (Sqft)" },
    ],
    []
  )

  const auditColumns = useMemo<ColumnDef<SurveyAuditHistoryItem>[]>(
    () => [
      { accessorKey: "propertyId", header: "Property ID" },
      { accessorKey: "when", header: "When" },
      { accessorKey: "action", header: "Action" },
      { accessorKey: "actor", header: "Actor" },
    ],
    []
  )

  const photoItems =
    survey.photos.length > 0
      ? survey.photos
      : [
          ...(survey.frontPhotoUrl
            ? [
                {
                  id: "front",
                  photoType: "FRONT",
                  label: "Front View",
                  url: survey.frontPhotoUrl,
                  capturedAt: null as string | null,
                  surveyorName: survey.surveyor,
                },
              ]
            : []),
          ...(survey.sidePhotoUrl
            ? [
                {
                  id: "side",
                  photoType: "SIDE",
                  label: "Side View",
                  url: survey.sidePhotoUrl,
                  capturedAt: null as string | null,
                  surveyorName: survey.surveyor,
                },
              ]
            : []),
        ]

  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-10 pb-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-24 left-[8%] size-80 rounded-full bg-violet-400/25 blur-3xl dark:bg-violet-600/20" />
        <div className="absolute top-52 right-[-4%] size-96 rounded-full bg-cyan-300/20 blur-3xl dark:bg-cyan-500/10" />
        <div className="absolute bottom-24 left-1/3 size-72 rounded-full bg-emerald-300/15 blur-3xl dark:bg-emerald-500/10" />
      </div>

      <div className="mb-4">
        <header
          className={cn(
            glassPanelClass,
            "sticky top-16 z-30 -mx-1 border-b border-white/40 px-5 py-5 backdrop-blur-2xl dark:border-white/10"
          )}
        >
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="w-fit cursor-pointer rounded-full border border-white/40 bg-white/40 px-3 backdrop-blur-md hover:bg-white/60 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              asChild
            >
              <Link href="/surveys">
                <ArrowLeft className="size-4" />
                Back
              </Link>
            </Button>
            <h1 className="text-center text-sm font-bold tracking-[0.22em] text-slate-900 uppercase sm:absolute sm:left-1/2 sm:-translate-x-1/2 dark:text-slate-50">
              Survey View
            </h1>
            <Badge
              className={cn(
                "w-fit rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase",
                statusBadgeClass(survey.status)
              )}
            >
              {survey.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <div className={cn(glassInsetClass, "p-3")}>
              <SurveyViewField
                label="Property ID"
                value={<span className="font-mono text-xs">{survey.propertyId}</span>}
              />
            </div>
            <div className={cn(glassInsetClass, "p-3")}>
              <SurveyViewField label="ULB Name" value={survey.ulbName} />
            </div>
            <div className={cn(glassInsetClass, "p-3")}>
              <SurveyViewField label="Ward No" value={survey.wardNo} />
            </div>
            <div className={cn(glassInsetClass, "p-3")}>
              <SurveyViewField label="Parcel No" value={survey.parcelNo} />
            </div>
            <div className={cn(glassInsetClass, "col-span-2 p-3 xl:col-span-1")}>
              <SurveyViewField label="Owner Name" value={survey.ownerName} />
            </div>
          </div>
        </header>
      </div>

      <GlassSection title="Property Identification" subtitle="ULB, ward, parcel and generated Property ID.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SurveyViewField label="ULB / Local Body" value={survey.ulbName} />
          <SurveyViewField label="Ward Number" value={survey.wardNo} />
          <SurveyViewField label="Sector / Zone" value={survey.sectorZone} />
          <SurveyViewField label="Parcel Number" value={survey.parcelNo} />
          <SurveyViewField label="Unit / Sub-No" value={survey.unitSubNo} />
          <SurveyViewField label="Property ID (Old)" value={survey.propertyIdOld} />
          <SurveyViewField label="Constructed Year" value={survey.constructedYear} />
          <SurveyViewField label="District" value={survey.district} />
          <SurveyViewField label="Surveyor" value={survey.surveyor} />
          <SurveyViewField label="Slum Area" value={survey.slumArea} />
        </div>
      </GlassSection>

      <GlassSection title="Owner & Household Details" subtitle="Respondent information and co-owner records.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SurveyViewField label="Respondent Name" value={survey.respondentName} />
          <SurveyViewField label="Mobile Number" value={survey.mobileNumber} />
          <SurveyViewField label="Family Size" value={survey.familySize ?? "—"} />
          <SurveyViewField label="Relationship w/ Owner" value={survey.relationshipWithOwner} />
          <SurveyViewField label="Alt Mobile" value={survey.altMobile} />
          <SurveyViewField label="Father / Husband Name" value={survey.fatherHusbandName} />
        </div>
        <GlassTable columns={ownerColumns} data={survey.owners} empty="No co-owner records." />
      </GlassSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassSection title="Address" subtitle="Postal and locality details.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SurveyViewField label="House / Door No" value={survey.houseDoorNo} />
            <SurveyViewField label="Colony / Society" value={survey.colonySociety} />
            <SurveyViewField label="Locality / Landmark" value={survey.localityLandmark} className="sm:col-span-2" />
            <SurveyViewField label="City" value={survey.city} />
            <SurveyViewField label="PIN Code" value={survey.pinCode} />
          </div>
        </GlassSection>

        <GlassSection title="GIS Mapping" subtitle="Captured field location coordinates.">
          <GisMap latitude={survey.latitude} longitude={survey.longitude} coordinates={survey.coordinates} />
        </GlassSection>
      </div>

      <GlassSection title="Taxation & Usage" subtitle="Assessment classification for property tax.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SurveyViewField label="Assessment Year" value={survey.assessmentYear} />
          <SurveyViewField label="Ownership Type" value={survey.ownershipType} />
          <SurveyViewField label="Property Use" value={survey.propertyUse} />
          <SurveyViewField label="Property Type" value={survey.propertyType} />
          <SurveyViewField label="Situation" value={survey.situation} />
          <SurveyViewField label="Road Type" value={survey.roadType} />
          <SurveyViewField label="Tax Rate Zone" value={survey.taxRateZone} />
        </div>
      </GlassSection>

      <GlassSection title="Floor Details" subtitle="Plot, plinth, and built-up measurements by floor.">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className={cn(glassInsetClass, "px-3 py-3")}>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
              Plot Area
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{survey.plotArea}</p>
          </div>
          <div className={cn(glassInsetClass, "px-3 py-3")}>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
              Plinth Area
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{survey.plinthArea}</p>
          </div>
          <div className={cn(glassInsetClass, "px-3 py-3")}>
            <p className="text-[10px] font-semibold tracking-[0.14em] text-slate-500 uppercase dark:text-slate-400">
              Built-Up Area
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-50">{survey.builtUpArea}</p>
          </div>
        </div>
        <GlassTable columns={floorColumns} data={survey.floors} empty="No floor records." />
      </GlassSection>

      <GlassSection title="Municipal Services" subtitle="Utility connections captured on site.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SurveyViewField label="Water Connection" value={survey.waterConnection} />
          <SurveyViewField label="Source of Water" value={survey.sourceOfWater} />
          <SurveyViewField label="Sanitation Type" value={survey.sanitationType} />
          <SurveyViewField label="Door-To-Door Collection" value={survey.doorToDoorCollection} />
          <SurveyViewField label="Electricity Consumer No" value={survey.electricityConsumerNo} />
        </div>
      </GlassSection>

      <GlassSection title="Photo Documentation" subtitle="Captured front and side survey photographs.">
        {photoItems.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {photoItems.map((photo) => (
              <SurveyPhotoCard
                key={photo.id}
                label={photo.label}
                url={photo.url}
                caption={[photo.capturedAt, photo.surveyorName].filter(Boolean).join(" · ") || survey.surveyor}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              glassInsetClass,
              "flex flex-col items-center justify-center gap-2 border-dashed py-14 text-slate-500 dark:text-slate-400"
            )}
          >
            <ImageIcon className="size-8 opacity-50" />
            <p className="text-sm">No photos attached</p>
          </div>
        )}
      </GlassSection>

      <GlassSection title="QC Remarks & Audit History" subtitle="Quality remarks and immutable field activity log.">
        {survey.qcRemarks || survey.qcRemarkItems.length ? (
          <div className="mb-4 space-y-2">
            {survey.qcRemarks ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-slate-800 backdrop-blur-md dark:text-slate-100">
                {survey.qcRemarks}
              </div>
            ) : null}
            {survey.qcRemarkItems.map((item) => (
              <div key={item.id} className={cn(glassInsetClass, "px-4 py-3 text-sm")}>
                <p className="text-slate-800 dark:text-slate-100">{item.body}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {item.author} · {item.createdAt}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div
            className={cn(
              glassInsetClass,
              "mb-4 border-dashed px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400"
            )}
          >
            No QC remarks yet.
          </div>
        )}
        <GlassTable columns={auditColumns} data={audits} empty="No audit history yet." />
      </GlassSection>
    </div>
  )
}
