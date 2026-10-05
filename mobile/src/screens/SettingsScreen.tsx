import { router } from "expo-router";
import { Database, RefreshCcw, Save, X } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconAction } from "../components/IconAction";
import { Screen } from "../components/Screen";
import type { ApprovalPolicy, ReasoningEffort, SandboxMode } from "../domain/bridge";
import { effortsForModel } from "../domain/composerOptions";
import {
  EXECUTION_PRESETS,
  approvalPolicies,
  executionDetail,
  findExecutionPreset,
  sandboxModes
} from "../domain/executionModes";
import { useTranslation } from "../i18n/useTranslation";
import type { LanguagePreference, Translator } from "../i18n";
import { useBridge } from "../state/BridgeProvider";
import { colors, spacing } from "../theme/colors";
import { McpServerRow } from "./settings/McpServerRow";
import { InfoRow, OptionGrid } from "./settings/SettingsRows";
import { styles } from "./settings/styles";

export function SettingsScreen() {
  const bridge = useBridge();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [baseUrlDraft, setBaseUrlDraft] = useState(bridge.baseUrl);
  const [expandedMcpServer, setExpandedMcpServer] = useState<string | null>(null);
  const [didAutoLoadMcp, setDidAutoLoadMcp] = useState(false);
  const selectedModel = useMemo(
    () => bridge.models.find((model) => model.id === bridge.selectedModelId) ?? null,
    [bridge.models, bridge.selectedModelId]
  );
  const serviceTiers = selectedModel?.serviceTiers ?? [];
  const efforts = effortsForModel(selectedModel);
  const activeExecutionPreset = findExecutionPreset({
    sandboxMode: bridge.sandboxMode,
    approvalPolicy: bridge.approvalPolicy,
    networkAccessEnabled: bridge.networkAccessEnabled
  });

  useEffect(() => {
    if (
      bridge.capabilities.mcp?.list &&
      !didAutoLoadMcp &&
      bridge.mcpServers.length === 0 &&
      !bridge.mcpError &&
      !bridge.isRefreshingMcp
    ) {
      setDidAutoLoadMcp(true);
      void bridge.refreshMcpServers();
    }
  }, [bridge, didAutoLoadMcp]);

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{t("settings.title")}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {bridge.health?.active_transport ?? "bridge"}
          </Text>
        </View>
        <IconAction
          icon={Save}
          label={t("settings.saveUrl")}
          variant="filled"
          onPress={() => {
            bridge.setBaseUrl(baseUrlDraft);
            void bridge.refreshAll();
          }}
        />
        <IconAction icon={X} label={t("common.close")} onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.lg + insets.bottom }]}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("language.title")}</Text>
          <OptionGrid
            title={t("language.title")}
            options={["system", "en", "zh"]}
            selected={bridge.preferences.language}
            labels={{
              system: t("language.system"),
              en: t("language.en"),
              zh: t("language.zh")
            }}
            onSelect={(value) => bridge.setLanguage(value as LanguagePreference)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.executionMode")}</Text>
          <InfoRow
            label={activeExecutionPreset ? t(activeExecutionPreset.labelKey) : t("common.custom")}
            value={executionDetail({
              sandboxMode: bridge.sandboxMode,
              approvalPolicy: bridge.approvalPolicy,
              networkAccessEnabled: bridge.networkAccessEnabled
            })}
          />
          <View style={styles.presetGrid}>
            {EXECUTION_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() =>
                  bridge.setExecutionSettings({
                    sandboxMode: preset.sandboxMode,
                    approvalPolicy: preset.approvalPolicy,
                    networkAccessEnabled: preset.networkAccessEnabled
                  })
                }
                style={[
                  styles.preset,
                  activeExecutionPreset?.id === preset.id && styles.presetActive
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    styles.presetLabel,
                    activeExecutionPreset?.id === preset.id && styles.presetLabelActive
                  ]}
                >
                  {t(preset.labelKey)}
                </Text>
                <Text
                  numberOfLines={2}
                  style={[
                    styles.presetDetail,
                    activeExecutionPreset?.id === preset.id && styles.presetDetailActive
                  ]}
                >
                  {preset.detail}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.bridge")}</Text>
          <TextInput
            value={baseUrlDraft}
            onChangeText={setBaseUrlDraft}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
          />
          <InfoRow label={t("common.status")} value={bridge.health?.status ?? t("settings.noResponse")} />
          <InfoRow label={t("common.auth")} value={bridge.health?.auth ?? "-"} />
          <InfoRow label={t("settings.cli")} value={bridge.health?.codex_cli_version ?? "-"} />
          <InfoRow label={t("common.allowlist")} value={bridge.allowlistFile ?? "-"} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitleNoMargin}>MCP</Text>
            {bridge.isRefreshingMcp ? <ActivityIndicator size="small" color={colors.accent} /> : null}
            <IconAction
              icon={RefreshCcw}
              label={t("settings.refreshMcp")}
              disabled={!bridge.capabilities.mcp?.list || bridge.isRefreshingMcp}
              onPress={() => void bridge.refreshMcpServers()}
            />
            <IconAction
              icon={Database}
              label={t("settings.reloadMcp")}
              disabled={!bridge.capabilities.mcp?.reload || bridge.isRefreshingMcp}
              onPress={() => void bridge.reloadMcpServers()}
            />
          </View>
          <InfoRow
            label={t("settings.capability")}
            value={
              bridge.capabilities.mcp?.list
                ? `${bridge.mcpServers.length} server(s)`
                : "Unavailable in this runtime"
            }
          />
          {bridge.mcpError ? (
            <Text numberOfLines={3} style={styles.errorText}>
              {bridge.mcpError}
            </Text>
          ) : null}
          {bridge.mcpServers.map((server) => (
            <McpServerRow
              key={server.name}
              server={server}
              expanded={expandedMcpServer === server.name}
              onToggle={() =>
                setExpandedMcpServer((current) => (current === server.name ? null : server.name))
              }
              onReadResource={(resource) => void bridge.readMcpResource(server.name, resource.uri)}
            />
          ))}
          {bridge.mcpResource ? (
            <View style={styles.mcpReadout}>
              <Text style={styles.optionTitle}>{t("settings.resourceContent")}</Text>
              <Text numberOfLines={10} style={styles.mcpReadoutText}>
                {mcpResourceText(bridge.mcpResource.contents, t)}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.build")}</Text>
          <InfoRow label={t("settings.gateway")} value={bridge.buildConfig.gateway} />
          <InfoRow label={t("settings.buildDefault")} value={bridge.buildConfig.apiBaseUrl} />
          <InfoRow
            label={t("settings.override")}
            value={bridge.buildConfig.bridgeUrlOverride ?? "-"}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.advanced")}</Text>
          <OptionGrid
            title={t("settings.approval")}
            options={approvalPolicies}
            selected={bridge.approvalPolicy}
            onSelect={(value) => bridge.setApprovalPolicy(value as ApprovalPolicy)}
          />
          <OptionGrid
            title={t("settings.sandbox")}
            options={sandboxModes}
            selected={bridge.sandboxMode}
            onSelect={(value) => bridge.setSandboxMode(value as SandboxMode)}
          />
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{t("settings.network")}</Text>
            <Switch value={bridge.networkAccessEnabled} onValueChange={bridge.setNetworkAccessEnabled} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.model")}</Text>
          <InfoRow
            label={t("common.current")}
            value={selectedModel?.displayName ?? bridge.selectedModelId ?? "-"}
          />
          <OptionGrid
            title={t("settings.reasoningEffort")}
            options={efforts}
            selected={bridge.reasoningEffort}
            onSelect={(value) => bridge.setReasoningEffort(value as ReasoningEffort)}
          />
          {serviceTiers.length > 0 ? (
            <OptionGrid
              title={t("settings.serviceTier")}
              options={["default", ...serviceTiers.map((tier) => tier.id)]}
              selected={bridge.serviceTier ?? "default"}
              onSelect={(value) => bridge.setServiceTier(value === "default" ? null : value)}
            />
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.saveDefaults, pressed && styles.pressed]}
            onPress={() => void bridge.saveCodexDefaults()}
          >
            <Text style={styles.saveDefaultsText}>{t("settings.saveDefaults")}</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.activeConfig")}</Text>
          <InfoRow label="model" value={stringValue(bridge.config?.config.model)} />
          <InfoRow
            label="model_reasoning_effort"
            value={stringValue(bridge.config?.config.model_reasoning_effort)}
          />
          <InfoRow label="service_tier" value={stringValue(bridge.config?.config.service_tier)} />
          <InfoRow label="approval_policy" value={stringValue(bridge.config?.config.approval_policy)} />
          <InfoRow label="sandbox_mode" value={stringValue(bridge.config?.config.sandbox_mode)} />
        </View>
      </ScrollView>
    </Screen>
  );
}

function stringValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

function mcpResourceText(
  contents: Array<{ text?: string; blob?: string; uri: string; mimeType?: string | null }>,
  t: Translator
) {
  if (contents.length === 0) {
    return t("settings.noContent");
  }

  return contents
    .map((content) => {
      if (content.text) {
        return content.text;
      }
      if (content.blob) {
        return t("settings.binaryContent", {
          mime: content.mimeType ?? "content",
          uri: content.uri
        });
      }
      return content.uri;
    })
    .join("\n\n");
}
