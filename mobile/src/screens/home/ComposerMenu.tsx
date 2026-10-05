import { Bot, Check, ChevronLeft, ChevronRight, Gauge, Menu, Paperclip, ShieldCheck, X, Zap } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconAction } from "../../components/IconAction";
import {
  effortsForModel,
  fastTierOptionsForModel,
  isServiceTierAvailable,
  type FastTierOption
} from "../../domain/composerOptions";
import type { CodexModel, ReasoningEffort } from "../../domain/bridge";
import { useBridge } from "../../state/BridgeProvider";
import { useTranslation } from "../../i18n/useTranslation";
import type { Translator } from "../../i18n";
import { colors, spacing } from "../../theme/colors";
import { limitsMenuDetail } from "./limits";
import { styles } from "./styles";

type MenuPanel = "main" | "models" | "effort" | "fast";

export function ComposerMenu({
  selectedModel,
  onOpenLimits,
  onAttachFile
}: {
  selectedModel: CodexModel | null;
  onOpenLimits: () => void;
  onAttachFile: () => void;
}) {
  const bridge = useBridge();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [panel, setPanel] = useState<MenuPanel>("main");
  const t = useTranslation();
  const efforts = effortsForModel(selectedModel);
  const fastTiers = fastTierOptionsForModel(selectedModel);
  const currentFastTier = fastTiers.find((tier) => tier.id === bridge.serviceTier) ?? null;
  const fastEnabled = fastTiers.length > 0;

  const close = () => {
    setVisible(false);
    setPanel("main");
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Composer options"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [styles.composerMenuButton, pressed && styles.composerMenuButtonPressed]}
      >
        <Menu size={21} color={colors.text} />
      </Pressable>

      <Modal transparent visible={visible} animationType="fade" onRequestClose={close}>
        <Pressable style={[styles.menuOverlay, { paddingBottom: spacing.lg + insets.bottom }]} onPress={close}>
          <Pressable style={styles.menuPanel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.menuHeader}>
              {panel === "main" ? (
                <View style={styles.menuTitleIcon}>
                  <Menu size={18} color={colors.text} />
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("common.back")}
                  onPress={() => setPanel("main")}
                  style={styles.menuBackButton}
                >
                  <ChevronLeft size={20} color={colors.text} />
                </Pressable>
              )}
              <Text style={styles.menuTitle}>{panelTitle(panel, t)}</Text>
              <IconAction icon={X} label={t("composer.closeMenu")} onPress={close} />
            </View>

            {panel === "main" ? (
              <View style={styles.menuItems}>
                <MenuItem
                  icon={<Bot size={18} color={colors.textMuted} />}
                  label={t("composer.models")}
                  detail={selectedModel?.displayName ?? bridge.selectedModelId ?? t("common.default")}
                  onPress={() => setPanel("models")}
                  showChevron
                />
                <MenuItem
                  icon={<Gauge size={18} color={colors.textMuted} />}
                  label={t("composer.effort")}
                  detail={bridge.reasoningEffort}
                  onPress={() => setPanel("effort")}
                  showChevron
                />
                <MenuItem
                  icon={<Zap size={18} color={fastEnabled ? colors.textMuted : colors.textSubtle} />}
                  label={t("composer.fast")}
                  detail={
                    currentFastTier?.label ?? (fastEnabled ? t("common.off") : t("common.unavailable"))
                  }
                  disabled={!fastEnabled}
                  onPress={() => setPanel("fast")}
                  showChevron
                />
                <MenuItem
                  icon={<ShieldCheck size={18} color={colors.textMuted} />}
                  label={t("composer.limits")}
                  detail={limitsMenuDetail(bridge, t)}
                  onPress={() => {
                    close();
                    onOpenLimits();
                  }}
                />
                <MenuItem
                  icon={<Paperclip size={18} color={colors.textMuted} />}
                  label={t("composer.attachFile")}
                  detail={t("home.attachFile")}
                  onPress={() => {
                    close();
                    onAttachFile();
                  }}
                />
              </View>
            ) : null}

            {panel === "models" ? (
              <ScrollView style={styles.optionList}>
                {bridge.models.map((model) => (
                  <SelectableItem
                    key={model.id}
                    label={model.displayName ?? model.id}
                    detail={model.defaultReasoningEffort ?? model.description ?? model.model}
                    selected={bridge.selectedModelId === model.id}
                    onPress={() => {
                      bridge.setSelectedModelId(model.id);
                      if (!isServiceTierAvailable(model, bridge.serviceTier)) {
                        bridge.setServiceTier(null);
                      }
                      close();
                    }}
                  />
                ))}
              </ScrollView>
            ) : null}

            {panel === "effort" ? (
              <View style={styles.menuItems}>
                {efforts.map((effort) => (
                  <SelectableItem
                    key={effort}
                    label={effort}
                    selected={bridge.reasoningEffort === effort}
                    onPress={() => {
                      bridge.setReasoningEffort(effort as ReasoningEffort);
                      close();
                    }}
                  />
                ))}
              </View>
            ) : null}

            {panel === "fast" ? (
              <View style={styles.menuItems}>
                <SelectableItem
                  label={t("common.off")}
                  detail={t("composer.useDefaultTier")}
                  selected={!bridge.serviceTier}
                  onPress={() => {
                    bridge.setServiceTier(null);
                    close();
                  }}
                />
                {fastTiers.length > 0 ? (
                  fastTiers.map((tier) => (
                    <FastTierItem
                      key={tier.id}
                      tier={tier}
                      selected={bridge.serviceTier === tier.id}
                      onPress={() => {
                        bridge.setServiceTier(tier.id);
                        close();
                      }}
                    />
                  ))
                ) : (
                  <SelectableItem
                    label={t("composer.noSpeedTiers")}
                    detail={t("composer.unavailableForModel")}
                    disabled
                  />
                )}
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({
  icon,
  label,
  detail,
  disabled = false,
  showChevron = false,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string | null | undefined;
  disabled?: boolean;
  showChevron?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        disabled && styles.menuItemDisabled,
        pressed && !disabled && styles.menuItemPressed
      ]}
    >
      {icon}
      <View style={styles.menuItemText}>
        <Text style={[styles.menuItemLabel, disabled && styles.mutedText]}>{label}</Text>
        {detail ? (
          <Text numberOfLines={1} style={[styles.menuItemDetail, disabled && styles.mutedText]}>
            {detail}
          </Text>
        ) : null}
      </View>
      {showChevron ? <ChevronRight size={18} color={disabled ? colors.textSubtle : colors.textMuted} /> : null}
    </Pressable>
  );
}

function SelectableItem({
  label,
  detail,
  selected = false,
  disabled = false,
  onPress = () => undefined
}: {
  label: string;
  detail?: string | null | undefined;
  selected?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.selectable,
        selected && styles.selectableActive,
        disabled && styles.menuItemDisabled,
        pressed && !disabled && styles.menuItemPressed
      ]}
    >
      <View style={styles.menuItemText}>
        <Text numberOfLines={1} style={[styles.selectableLabel, selected && styles.selectableLabelActive]}>
          {label}
        </Text>
        {detail ? (
          <Text numberOfLines={1} style={styles.menuItemDetail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {selected ? <Check size={18} color={colors.accent} /> : null}
    </Pressable>
  );
}

function FastTierItem({
  tier,
  selected,
  onPress
}: {
  tier: FastTierOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <SelectableItem
      label={tier.label}
      detail={tier.description ?? tier.id}
      selected={selected}
      disabled={!tier.available}
      onPress={onPress}
    />
  );
}

function panelTitle(panel: MenuPanel, t: Translator) {
  switch (panel) {
    case "models":
      return t("composer.models");
    case "effort":
      return t("composer.effort");
    case "fast":
      return t("composer.fast");
    default:
      return t("composer.optionsTitle");
  }
}
