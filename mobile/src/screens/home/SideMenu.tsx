import { router } from "expo-router";
import { FolderGit2, FolderPlus, ListTree, MessageSquarePlus, RefreshCcw, Settings, X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StatusPill } from "../../components/StatusPill";
import { useTranslation } from "../../i18n/useTranslation";
import { useBridge } from "../../state/BridgeProvider";
import { colors, radii, spacing } from "../../theme/colors";
import { fontWeights } from "../../theme/typography";
import { compactPath } from "../../utils/format";

/**
 * Everything that used to sit in the chat header (identity, connection state,
 * current conversation and the navigation actions) lives here so the main
 * screen is just the conversation.
 */
export function SideMenu({
  visible,
  onClose,
  onAddFolder
}: {
  visible: boolean;
  onClose: () => void;
  onAddFolder: () => void;
}) {
  const bridge = useBridge();
  const t = useTranslation();
  const insets = useSafeAreaInsets();

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable accessibilityLabel={t("menu.close")} onPress={onClose} style={styles.backdrop} />
        <View style={[styles.panel, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.appTitle}>Codex Mobile</Text>
              <Text numberOfLines={1} style={styles.subtitle}>
                {bridge.selectedWorkspace
                  ? compactPath(bridge.selectedWorkspace.path)
                  : t("conversations.noRepository")}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("menu.close")}
              onPress={onClose}
              style={styles.closeButton}
            >
              <X size={20} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.statusRow}>
            <StatusPill
              label={bridge.health?.codex_ready ? t("menu.online") : t("menu.offline")}
              tone={bridge.health?.codex_ready ? "ok" : bridge.error ? "error" : "warn"}
            />
            <Text style={styles.statusDetail} numberOfLines={1}>
              {bridge.health?.active_transport ?? "bridge"}
            </Text>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t("menu.conversation")}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => go("/conversations")}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <ListTree size={18} color={colors.text} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={styles.rowTitle}>
                    {bridge.selectedThread?.title ?? t("home.newConversation")}
                  </Text>
                  <Text numberOfLines={1} style={styles.rowDetail}>
                    {t("menu.threadCount", { count: bridge.threads.length })}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.section}>
              <MenuRow
                icon={<MessageSquarePlus size={18} color={colors.text} />}
                title={t("home.newConversation")}
                onPress={() => {
                  onClose();
                  void bridge.createNewThread();
                }}
              />
              <MenuRow
                icon={<FolderPlus size={18} color={colors.text} />}
                title={t("home.addFolder")}
                onPress={() => {
                  onClose();
                  onAddFolder();
                }}
              />
              <MenuRow
                icon={<FolderGit2 size={18} color={colors.text} />}
                title={t("home.repositories")}
                onPress={() => go("/repositories")}
              />
              <MenuRow
                icon={<RefreshCcw size={18} color={colors.text} />}
                title={t("common.refresh")}
                onPress={() => {
                  onClose();
                  void bridge.refreshAll();
                }}
              />
              <MenuRow
                icon={<Settings size={18} color={colors.text} />}
                title={t("home.settings")}
                onPress={() => go("/settings")}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  title,
  onPress
}: {
  icon: ReactNode;
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      {icon}
      <Text style={styles.rowTitle}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row"
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(16, 24, 40, 0.42)"
  },
  panel: {
    width: "82%",
    maxWidth: 340,
    backgroundColor: colors.background,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: spacing.lg
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  appTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: fontWeights.title
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: fontWeights.body,
    marginTop: 2
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md
  },
  statusDetail: {
    flex: 1,
    minWidth: 0,
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: fontWeights.body
  },
  body: {
    flex: 1,
    marginTop: spacing.lg
  },
  bodyContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg
  },
  section: {
    gap: spacing.xs
  },
  sectionLabel: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: fontWeights.label,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: spacing.xs
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  rowPressed: {
    opacity: 0.78
  },
  rowText: {
    flex: 1,
    minWidth: 0
  },
  rowTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: fontWeights.body
  },
  rowDetail: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: fontWeights.body,
    marginTop: 2
  }
});
