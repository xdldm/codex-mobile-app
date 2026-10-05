import { Pressable, Text, View } from "react-native";

import { styles } from "./styles";

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

export function OptionGrid({
  title,
  options,
  selected,
  onSelect,
  labels
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (value: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <View style={styles.optionBlock}>
      <Text style={styles.optionTitle}>{title}</Text>
      <View style={styles.options}>
        {options.map((option) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            style={[styles.option, selected === option && styles.optionActive]}
          >
            <Text style={[styles.optionText, selected === option && styles.optionTextActive]}>
              {labels?.[option] ?? option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
