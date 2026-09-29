import { Text } from "@/components/ui"
import { isCompleteOtpCode, normalizeOtpDigits } from "@/features/auth/lib/otp"
import { colors, radius, spacing } from "@/theme"
import { useEffect, useRef, useState } from "react"
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native"

const DIGIT_COUNT = 6

type Props = {
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  error?: string | null
  autoFocus?: boolean
}

/**
 * Six-box OTP input with paste support and auto-advance.
 * Codes are never persisted — value lives only in parent form state.
 */
export function OtpInput({ value, onChange, disabled = false, error, autoFocus = true }: Props) {
  const digits = normalizeOtpDigits(value)
    .padEnd(DIGIT_COUNT, " ")
    .slice(0, DIGIT_COUNT)
    .split("")
  const inputRefs = useRef<(TextInputType | null)[]>([])
  const [focusedIndex, setFocusedIndex] = useState(0)

  useEffect(() => {
    if (autoFocus && !disabled) {
      inputRefs.current[0]?.focus()
    }
  }, [autoFocus, disabled])

  function commit(next: string) {
    onChange(normalizeOtpDigits(next))
  }

  function handleChangeAt(index: number, text: string) {
    if (disabled) {
      return
    }

    const cleaned = text.replace(/\D/g, "")
    if (cleaned.length > 1) {
      const pasted = normalizeOtpDigits(cleaned)
      commit(pasted)
      const focusAt = Math.min(pasted.length, DIGIT_COUNT - 1)
      inputRefs.current[focusAt]?.focus()
      setFocusedIndex(focusAt)
      return
    }

    const current = normalizeOtpDigits(value)
    const chars = current.split("")
    while (chars.length < DIGIT_COUNT) {
      chars.push("")
    }

    if (cleaned.length === 0) {
      chars[index] = ""
      commit(chars.join(""))
      return
    }

    chars[index] = cleaned
    const next = chars.join("").slice(0, DIGIT_COUNT)
    commit(next)
    if (index < DIGIT_COUNT - 1) {
      inputRefs.current[index + 1]?.focus()
      setFocusedIndex(index + 1)
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key !== "Backspace" || disabled) {
      return
    }
    const current = normalizeOtpDigits(value)
    if (current[index]) {
      return
    }
    if (index > 0) {
      const chars = current.split("")
      while (chars.length < DIGIT_COUNT) {
        chars.push("")
      }
      chars[index - 1] = ""
      commit(chars.join(""))
      inputRefs.current[index - 1]?.focus()
      setFocusedIndex(index - 1)
    }
  }

  return (
    <View style={styles.wrap} accessibilityLabel="Verification code">
      <Text variant="label" tone="secondary">
        Verification code
      </Text>
      <View style={styles.row}>
        {digits.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref
            }}
            value={digit.trim()}
            onChangeText={(text) => handleChangeAt(index, text)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
            onFocus={() => setFocusedIndex(index)}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={DIGIT_COUNT}
            editable={!disabled}
            selectTextOnFocus
            style={[
              styles.box,
              focusedIndex === index && styles.boxFocused,
              error ? styles.boxError : null,
              disabled && styles.boxDisabled,
            ]}
            accessibilityLabel={`Digit ${index + 1} of ${DIGIT_COUNT}`}
          />
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Paste verification code"
        disabled={disabled}
        onPress={() => inputRefs.current[0]?.focus()}
        style={styles.pasteHint}
      >
        <Text variant="caption" tone="secondary">
          Paste a 6-digit code if available
        </Text>
      </Pressable>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

export function isCompleteOtp(code: string): boolean {
  return isCompleteOtpCode(code, DIGIT_COUNT)
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    minHeight: 52,
    maxWidth: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "600",
    color: colors.text,
  },
  boxFocused: {
    borderColor: colors.primary,
  },
  boxError: {
    borderColor: colors.danger,
  },
  boxDisabled: {
    opacity: 0.55,
  },
  pasteHint: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs,
  },
})
