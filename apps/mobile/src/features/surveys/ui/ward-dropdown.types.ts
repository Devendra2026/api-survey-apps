export type WardDropdownOption = {
  value: string
  label: string
}

export type WardDropdownProps = {
  options: readonly WardDropdownOption[]
  value: string | null
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}
