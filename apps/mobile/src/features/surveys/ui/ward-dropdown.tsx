import { SurveySelect } from "./SurveySelect"
import type { WardDropdownProps } from "./ward-dropdown.types"

/** Open the search field once the ward list is long enough to scroll. */
const WARD_SEARCH_MIN_COUNT = 8

/**
 * iOS and other platforms. Compose menus are Android-only, so this field
 * opens the same option sheet used by the rest of the survey form.
 */
export function WardDropdown({
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select ward",
}: WardDropdownProps) {
  return (
    <SurveySelect
      label="Ward"
      required
      options={options}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      searchable={options.length >= WARD_SEARCH_MIN_COUNT}
      onChange={(next) => {
        if (next) onChange(next)
      }}
    />
  )
}
