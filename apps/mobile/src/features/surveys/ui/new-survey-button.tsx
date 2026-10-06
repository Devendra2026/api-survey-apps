import { Button } from "@/components/ui"
import type { NewSurveyButtonProps } from "./new-survey-button.types"

/** iOS and fallback control. Android uses a Material 3 button. */
export function NewSurveyButton({ onPress }: NewSurveyButtonProps) {
  return <Button title="+ New survey" onPress={onPress} />
}
