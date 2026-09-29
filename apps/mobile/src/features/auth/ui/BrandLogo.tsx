import { spacing } from "@/theme"
import { Image } from "expo-image"
import { StyleSheet, View, type ImageStyle, type StyleProp } from "react-native"

type Props = {
  width?: number
  height?: number
  style?: StyleProp<ImageStyle>
}

/**
 * Bundled SDV EduTech logo — never use a remote URL for brand on auth screens.
 */
export function BrandLogo({ width = 180, height = 64, style }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="image" accessibilityLabel="SDV EduTech">
      <Image
        source={require("../../../../assets/logo.png")}
        style={[{ width, height }, style]}
        contentFit="contain"
        accessibilityLabel="SDV EduTech"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: spacing.xs,
  },
})
