import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SvgXml } from "react-native-svg";
import { SUNFLOWER_SVG } from "@/assets/sunflower";

export const theme = {
  bg: "#0b1220",
  card: "#111a2e",
  surface2: "#0e1626",
  border: "#243049",
  borderStrong: "#2e3c58",
  text: "#e6ebf5",
  textSoft: "#cdd6e6",
  muted: "#8b97ad",
  accent: "#f5a05a",
  accentText: "#1a1206",
  danger: "#ef6b6b",
  ok: "#5fbf8f",
};

// Gradientes do design (nao fazem parte do theme de cores solidas).
export const CTA_GRADIENT = ["#ffd28c", "#f6a85a"] as const;
const CTA_TEXT = "#2a1606";
export const BRAND_GRADIENT = ["#f3d886", "#dccf96", "#aac7d4", "#7cc0d6", "#69c4ab"] as const;
const AVATAR_GRADIENT = ["#f5a05a", "#d9863f"] as const;

export function Screen({ children }: { children: React.ReactNode }) {
  // Teclado nao deve cobrir os campos: o ScrollView com flex:1 + adjustResize (Android)
  // permite rolar o input focado para cima; o KeyboardAvoidingView trata o iOS. O padding
  // inferior generoso garante folga para os ultimos campos do formulario.
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.bg }}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
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

// Rotulo CAPS de secao (muted, letterSpacing).
export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children.toUpperCase()}</Text>;
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
        isDanger && { borderColor: theme.danger, borderWidth: 1 },
        !isPrimary && !isDanger && { borderColor: theme.border, borderWidth: 1 },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={CTA_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={isPrimary ? CTA_TEXT : theme.text} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            isPrimary && { fontWeight: "800" },
            { color: isPrimary ? CTA_TEXT : isDanger ? theme.danger : theme.text },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

// Circulo com iniciais sobre gradiente.
export function Avatar({
  name,
  size = 44,
  colors = AVATAR_GRADIENT,
}: {
  name?: string | null;
  size?: number;
  colors?: readonly [string, string, ...string[]];
}) {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ color: CTA_TEXT, fontWeight: "800", fontSize: size * 0.38 }}>{initials}</Text>
    </LinearGradient>
  );
}

// Pilula de status. ok = verde; accent = ambar.
export function StatusChip({ label, tone = "accent" }: { label: string; tone?: "ok" | "accent" }) {
  const color = tone === "ok" ? theme.ok : theme.accent;
  const bg = tone === "ok" ? "rgba(95,191,143,0.16)" : "rgba(245,160,90,0.16)";
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

// Girassol da marca (SVG vetorial).
export function Sunflower({ size = 34 }: { size?: number }) {
  return <SvgXml xml={SUNFLOWER_SVG} width={size} height={size} />;
}

// Topo da marca: gradiente + ladrilho do girassol + nome + tagline.
export function BrandHero({
  title,
  tagline,
}: {
  title: string;
  tagline?: string;
}) {
  return (
    <LinearGradient
      colors={BRAND_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.brandHero}
    >
      <View style={styles.brandTile}>
        <Sunflower size={40} />
      </View>
      <Text style={styles.brandTitle}>{title}</Text>
      {tagline ? <Text style={styles.brandTagline}>{tagline}</Text> : null}
    </LinearGradient>
  );
}

// Cartao pequeno de indicador: rotulo em cima, valor grande embaixo.
export function IndicatorCard({
  label,
  value,
  tone = "text",
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "accent" | "text";
}) {
  const color = tone === "ok" ? theme.ok : tone === "accent" ? theme.accent : theme.text;
  return (
    <View style={styles.indicatorCard}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{value}</Text>
    </View>
  );
}

// Segmented control de 2+ opcoes (ativo = ambar).
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.segmentItem, active && { backgroundColor: theme.accent }]}
          >
            <Text style={{ color: active ? theme.accentText : theme.muted, fontWeight: "700", fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Fileira de pilulas de dia. Dia ativo em ambar.
const WEEKDAY_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
export function DayStrip({
  days,
  selected,
  onSelect,
}: {
  days: Date[];
  selected: Date;
  onSelect: (d: Date) => void;
}) {
  const selKey = selected.toDateString();
  return (
    <View style={styles.dayStrip}>
      {days.map((d) => {
        const active = d.toDateString() === selKey;
        return (
          <Pressable
            key={d.toISOString()}
            onPress={() => onSelect(d)}
            style={[styles.dayPill, active && { backgroundColor: theme.accent, borderColor: theme.accent }]}
          >
            <Text style={{ color: active ? theme.accentText : theme.muted, fontSize: 10, fontWeight: "700" }}>
              {WEEKDAY_ABBR[d.getDay()]}
            </Text>
            <Text style={{ color: active ? theme.accentText : theme.text, fontSize: 16, fontWeight: "800" }}>
              {d.getDate()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Grafico de barras simples (sem libs). Barra de destaque com gradiente claro.
export function WeeklyBars({
  data,
  labels,
  highlightIndex,
}: {
  data: number[];
  labels: string[];
  highlightIndex?: number;
}) {
  const max = Math.max(1, ...data);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: 10 }}>
      {data.map((v, i) => {
        const h = Math.max(6, Math.round((v / max) * 96));
        const highlight = i === highlightIndex;
        return (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: 6 }}>
            <LinearGradient
              colors={highlight ? ["#ffe2b0", "#f6a85a"] : ["#f5a05a", "#d9863f"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={{ width: "100%", height: h, borderRadius: 8 }}
            />
            <Text style={{ color: theme.muted, fontSize: 11, fontWeight: "600" }}>{labels[i]}</Text>
          </View>
        );
      })}
    </View>
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
            <Text style={[styles.chipText, active && { color: theme.accentText, fontWeight: "700" }]}>{opt.label}</Text>
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
  screenContent: { padding: 16, gap: 14, paddingBottom: 160 },
  card: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  h1: { color: theme.accent, fontSize: 26, fontWeight: "800" },
  h2: { color: theme.text, fontSize: 17, fontWeight: "700" },
  muted: { color: theme.muted, fontSize: 13 },
  label: { color: theme.accent, fontSize: 13, fontWeight: "700" },
  sectionLabel: { color: theme.muted, fontSize: 12, fontWeight: "600", letterSpacing: 1 },
  input: {
    backgroundColor: theme.bg,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  buttonText: { fontSize: 15, fontWeight: "700" },
  brandHero: {
    borderRadius: 22,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: "center",
    gap: 8,
  },
  brandTile: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: theme.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: { color: "#15203a", fontSize: 24, fontWeight: "800" },
  brandTagline: { color: "#1f3a52", fontSize: 13, fontWeight: "600", textAlign: "center" },
  indicatorCard: {
    flex: 1,
    backgroundColor: theme.surface2,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: theme.surface2,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 999,
  },
  dayStrip: { flexDirection: "row", gap: 8, justifyContent: "space-between" },
  dayPill: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface2,
  },
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
