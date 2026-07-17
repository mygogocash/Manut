import { Text, TextInput, type TextInputProps, View } from "react-native";

import { colors, radii } from "./tokens";

export interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...props }: TextFieldProps) {
  return (
    <View style={{ gap: 7 }}>
      <Text selectable style={{ fontWeight: "600", color: colors.textStrong }}>
        {label}
      </Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        style={[
          {
            minHeight: 48,
            paddingHorizontal: 14,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            borderRadius: radii.control,
            backgroundColor: colors.surfaceRaised,
            color: colors.text,
          },
          style,
        ]}
      />
    </View>
  );
}
