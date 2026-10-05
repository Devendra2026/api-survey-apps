export type SelectOption = {
  value: string
  label: string
}

export type SelectProps = {
  label: string
  value: string | null
  onChange: (next: string | null) => void
  options: readonly SelectOption[]
  required?: boolean
  disabled?: boolean
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  placeholder?: string
  searchable?: boolean
  /**
   * `inline` lists options under the field. Use it inside another modal so Android
   * does not have to present a second modal.
   */
  presentation?: "modal" | "inline"
}
