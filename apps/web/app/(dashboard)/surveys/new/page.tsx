"use client"

import { FormField } from "@/components/forms/form-field"
import { PageHeader } from "@/components/shared/page-elements"
import { useDistricts, useStates, useSurveyMutations, useUlbs, useWards } from "@/hooks/use-api"
import { getApiErrorMessage } from "@/lib/api/client"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
  const wardId = form.watch("wardId")

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
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="New survey"
        description="Create a draft property survey. Add floors, photos, and GPS before submitting."
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Location</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="State" required error={form.formState.errors.stateId?.message}>
              <Select
                value={stateId}
                onValueChange={(value) => {
                  form.setValue("stateId", value, { shouldValidate: true })
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
            </FormField>

            <FormField label="District" required error={form.formState.errors.districtId?.message}>
              <Select
                value={districtId}
                disabled={!stateId}
                onValueChange={(value) => {
                  form.setValue("districtId", value, { shouldValidate: true })
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
            </FormField>

            <FormField label="ULB" required error={form.formState.errors.ulbId?.message}>
              <Select
                value={ulbId}
                disabled={!districtId}
                onValueChange={(value) => {
                  form.setValue("ulbId", value, { shouldValidate: true })
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
            </FormField>

            <FormField label="Ward" required error={form.formState.errors.wardId?.message}>
              <Select
                value={wardId}
                disabled={!ulbId}
                onValueChange={(value) => form.setValue("wardId", value, { shouldValidate: true })}
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
            </FormField>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Property details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Property ID"
              htmlFor="propertyId"
              required
              className="sm:col-span-2"
              error={form.formState.errors.propertyId?.message}
            >
              <Input id="propertyId" {...form.register("propertyId")} />
            </FormField>
            <FormField label="Respondent name" htmlFor="respondentName">
              <Input id="respondentName" {...form.register("respondentName")} />
            </FormField>
            <FormField label="Mobile" htmlFor="mobileNumber">
              <Input id="mobileNumber" {...form.register("mobileNumber")} />
            </FormField>
            <FormField label="House / door no." htmlFor="houseDoorNo">
              <Input id="houseDoorNo" {...form.register("houseDoorNo")} />
            </FormField>
            <FormField label="Locality" htmlFor="locality">
              <Input id="locality" {...form.register("locality")} />
            </FormField>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </form>
    </div>
  )
}
