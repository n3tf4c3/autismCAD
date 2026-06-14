import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

export const theme = {
  bg: "#0b1220",
  card: "#111a2e",
  border: "#243049",
  text: "#e6ebf5",
  muted: "#8b97ad",
  accent: "#f5a05a",
  accentText: "#1a1206",
  danger: "#ef6b6b",
  ok: "#5fbf8f",
};

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.screenContent}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function H2({ children }: { children: React.ReactNode }) {
  return <Text style={styles.h2}>{children}</Text>;
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.muted}>{children}</Text>;
}

export function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 4 }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        placeholderTextColor={theme.muted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
}) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        isPrimary && { backgroundColor: theme.accent },
        isDanger && { backgroundColor: "transparent", borderColor: theme.danger, borderWidth: 1 },
        !isPrimary && !isDanger && { backgroundColor: "transparent", borderColor: theme.border, borderWidth: 1 },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? theme.accentText : theme.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            { color: isPrimary ? theme.accentText : isDanger ? theme.danger : theme.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// Selecao unica por botoes (substitui o <select> da web em sets pequenos).
export function OptionRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T | "";
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.optionRow}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.chip, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
          >
            <Text style={[styles.chipText, active && { color: theme.accentText }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <Text style={{ color: theme.danger }}>{children}</Text>;
}

const styles = StyleSheet.create({
  screenContent: { padding: 16, gap: 14, paddingBottom: 48 },
  card: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  h1: { color: theme.accent, fontSize: 22, fontWeight: "700" },
  h2: { color: theme.text, fontSize: 16, fontWeight: "600" },
  muted: { color: theme.muted, fontSize: 13 },
  label: { color: theme.muted, fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: theme.bg,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: theme.text, fontSize: 13 },
});
