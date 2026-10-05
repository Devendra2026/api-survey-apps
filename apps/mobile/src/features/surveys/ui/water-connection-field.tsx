import { optionLabel } from "../lib/labels"
import type { WaterConnection } from "../types"
import { ChoiceRadios } from "./choice-radios"

/**
 * Yes / No for municipal water. Partial stays visible only when that enum is already stored.
 * Android draws Jetpack Compose radio buttons.
 */
export function WaterConnectionField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string
  value: WaterConnection | null
  disabled?: boolean
  onChange: (next: WaterConnection | null) => void
}) {
  const choices: WaterConnection[] = value === "PARTIAL" ? ["YES", "NO", "PARTIAL"] : ["YES", "NO"]
  return (
    <ChoiceRadios
      label={label}
      disabled={disabled}
      value={value}
      options={choices.map((choice) => ({ value: choice, label: optionLabel(choice) }))}
      onChange={(next) => {
        const match = choices.find((choice) => choice === next)
        if (!match) return
        onChange(match === value ? null : match)
      }}
    />
  )
}
