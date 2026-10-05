import { ChoiceRadios } from "./choice-radios"

/**
 * Yes/No for a boolean survey field.
 * Android uses Jetpack Compose radio buttons; other platforms use the same row.
 */
export function NativeYesNoField({
  label,
  value,
  onChange,
  disabled,
  required,
}: {
  label: string
  value: boolean | null
  onChange: (next: boolean | null) => void
  disabled?: boolean
  required?: boolean
}) {
  const selected = value === true ? "yes" : value === false ? "no" : null
  return (
    <ChoiceRadios
      label={label}
      required={required}
      disabled={disabled}
      value={selected}
      options={[
        { value: "yes", label: "Yes" },
        { value: "no", label: "No" },
      ]}
      onChange={(next) => onChange(next === "yes")}
    />
  )
}
