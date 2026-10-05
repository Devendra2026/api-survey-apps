export type OutlinedFieldProps = {
  label: string
  value: string
  onChangeText?: (value: string) => void
  placeholder?: string
  helper?: string
  error?: string
  editable?: boolean
  keyboard?: "default" | "number-pad"
  maxLength?: number
  required?: boolean
}
