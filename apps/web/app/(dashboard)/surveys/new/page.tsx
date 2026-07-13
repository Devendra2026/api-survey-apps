"use client"

import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { PageHeader } from "@/components/shared/page-elements"
import { useDistricts, useStates, useSurveyMutations, useUlbs, useWards } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"

const schema = z.object({
  stateId: z.string().min(1, "State is required"),
  districtId: z.string().min(1, "District is required"),
  ulbId: z.string().min(1, "ULB is required"),
  wardId: z.string().min(1, "Ward is required"),
  propertyId: z.string().min(1, "Property ID is required"),
  respondentName: z.string().optional(),
  mobileNumber: z.string().optional(),
  locality: z.string().optional(),
  houseDoorNo: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export default function NewSurveyPage() {
  const router = useRouter()
  const { create } = useSurveyMutations()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      stateId: "",
      districtId: "",
      ulbId: "",
      wardId: "",
      propertyId: "",
    },
  })

  const stateId = form.watch("stateId")
  const districtId = form.watch("districtId")
  const ulbId = form.watch("ulbId")

  const { data: states } = useStates({ limit: 100 })
  const { data: districts } = useDistricts(stateId)
  const { data: ulbs } = useUlbs(districtId)
  const { data: wards } = useWards(ulbId)

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const survey = await create.mutateAsync(values)
      toast.success("Survey created")
      router.push(`/surveys/${(survey as { id: string }).id}`)
    } catch (error) {
      toast.error(getApiErrorMessage(error))
    }
  })

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New survey"
        description="Create a draft property survey. Add floors, photos, and GPS before submitting."
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>State</Label>
              <Select
                value={stateId}
                onValueChange={(value) => {
                  form.setValue("stateId", value)
                  form.setValue("districtId", "")
                  form.setValue("ulbId", "")
                  form.setValue("wardId", "")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states?.items.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>District</Label>
              <Select
                value={districtId}
                disabled={!stateId}
                onValueChange={(value) => {
                  form.setValue("districtId", value)
                  form.setValue("ulbId", "")
                  form.setValue("wardId", "")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent>
                  {districts?.items.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>ULB</Label>
              <Select
                value={ulbId}
                disabled={!districtId}
                onValueChange={(value) => {
                  form.setValue("ulbId", value)
                  form.setValue("wardId", "")
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ULB" />
                </SelectTrigger>
                <SelectContent>
                  {ulbs?.items.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Ward</Label>
              <Select
                value={form.watch("wardId")}
                disabled={!ulbId}
                onValueChange={(value) => form.setValue("wardId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards?.items.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.wardNumber} — {w.wardName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Property details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="propertyId">Property ID *</Label>
              <Input id="propertyId" {...form.register("propertyId")} />
              {form.formState.errors.propertyId ? (
                <p className="text-destructive text-xs">{form.formState.errors.propertyId.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="respondentName">Respondent name</Label>
              <Input id="respondentName" {...form.register("respondentName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobileNumber">Mobile</Label>
              <Input id="mobileNumber" {...form.register("mobileNumber")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="houseDoorNo">House / door no.</Label>
              <Input id="houseDoorNo" {...form.register("houseDoorNo")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="locality">Locality</Label>
              <Input id="locality" {...form.register("locality")} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating..." : "Create draft"}
          </Button>
        </div>
      </form>
    </div>
  )
}
