import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Code2,
  Copy,
  FileCode2,
  ShieldCheck,
  Terminal,
  X
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, PanResponder, Pressable, ScrollView, Text, View } from "react-native";

import { MarkdownText } from "../../components/MarkdownText";
import type { ChatMessage, ChatMessagePart, PendingApproval } from "../../domain/bridge";
import { messageTextFromParts } from "../../domain/chatMessageParts";
import { useTranslation } from "../../i18n/useTranslation";
import type { Translator } from "../../i18n";
import { colors } from "../../theme/colors";
import { styles } from "./styles";

export function MessageBubble({
  message,
  onRespondApproval
}: {
  message: ChatMessage;
  onRespondApproval: (approval: PendingApproval, decision: string) => void;
}) {
  const isUser = message.role === "user";
  const t = useTranslation();
  const parts = messageParts(message);
  const copyText = useMemo(
    () => messageTextFromParts(parts).trim() || message.text.trim(),
    [parts, message.text]
  );
  const { copied, copy } = useCopyFeedback();

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <View style={styles.messageHeader}>
          <Text style={[styles.messageRole, isUser && styles.userRole]}>
            {isUser ? t("message.you") : "Codex"}
            {message.pending ? " ." : ""}
          </Text>
          {isUser ? <DeliveryStatusIcon status={message.deliveryStatus} /> : null}
        </View>
        {isUser ? (
          <>
            <MarkdownText text={message.text} variant="inverted" />
            {message.deliveryStatus === "failed" ? (
              <UserMessageErrorDrawer error={message.deliveryError ?? t("message.messageFailed")} />
            ) : null}
          </>
        ) : parts.length > 0 ? (
          <View style={styles.messageParts}>
            {parts.map((part, index) => (
              <MessagePart
                key={part.id}
                part={part}
                isFirst={index === 0}
                onRespondApproval={onRespondApproval}
              />
            ))}
          </View>
        ) : (
          <View style={styles.workingRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.workingText}>{t("message.working")}</Text>
          </View>
        )}
        {!isUser && copyText ? (
          <MessageCopyAction
            copied={copied}
            label={copied ? t("message.copied") : t("message.copyAll")}
            accessibilityLabel={copied ? t("message.fullResponseCopied") : t("message.copyFullResponse")}
            onPress={() => void copy(copyText)}
          />
        ) : null}
      </View>
    </View>
  );
}

function MessageCopyAction({
  copied,
  label,
  accessibilityLabel,
  onPress
}: {
  copied: boolean;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const Icon = copied ? Check : Copy;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.messageCopyAction, pressed && styles.messageCopyActionPressed]}
    >
      <Icon size={13} color={copied ? colors.success : colors.textMuted} strokeWidth={2.6} />
      <Text style={[styles.messageCopyActionText, copied && styles.messageCopyActionTextDone]}>
        {label}
      </Text>
    </Pressable>
  );
}

function useCopyFeedback() {
  const [copied, setCopied] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
    },
    []
  );

  const copy = useCallback(async (text: string) => {
    const value = text.trim();
    if (!value) {
      return;
    }

    await Clipboard.setStringAsync(value);
    setCopied(true);
    if (timeout.current) {
      clearTimeout(timeout.current);
    }
    timeout.current = setTimeout(() => setCopied(false), 1600);
  }, []);

  return { copied, copy };
}

function UserMessageErrorDrawer({ error }: { error: string }) {
  const [expanded, setExpanded] = useState(false);
  const t = useTranslation();
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) =>
          Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dx < -12) {
            setExpanded(true);
          } else if (gesture.dx > 12) {
            setExpanded(false);
          }
        }
      }),
    []
  );

  return (
    <View style={styles.messageErrorDrawer}>
      <Pressable
        {...panResponder.panHandlers}
        accessibilityLabel={expanded ? t("message.hideSendError") : t("message.showSendError")}
        accessibilityRole="button"
        onPress={() => setExpanded((current) => !current)}
        style={[styles.messageErrorTab, expanded && styles.messageErrorTabOpen]}
      >
        <AlertCircle size={15} color={colors.danger} strokeWidth={2.6} />
      </Pressable>
      {expanded ? (
        <View style={styles.messageErrorPanel}>
          <Text style={styles.messageErrorTitle}>{t("message.sendFailed")}</Text>
          <Text numberOfLines={6} selectable style={styles.messageErrorText}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DeliveryStatusIcon({
  status
}: {
  status: ChatMessage["deliveryStatus"];
}) {
  const t = useTranslation();
  if (!status) {
    return null;
  }

  const tone = deliveryTone(status, t);
  const Icon = status === "sending" ? Clock3 : status === "sent" ? CheckCircle2 : AlertCircle;

  return (
    <View accessibilityLabel={tone.label} accessible style={styles.deliveryBadge}>
      <Icon size={13} color={tone.color} strokeWidth={2.6} />
    </View>
  );
}

function MessagePart({
  part,
  isFirst,
  onRespondApproval
}: {
  part: ChatMessagePart;
  isFirst: boolean;
  onRespondApproval: (approval: PendingApproval, decision: string) => void;
}) {
  const t = useTranslation();

  if (part.type === "text") {
    const text = part.text || (part.pending ? t("message.working") : "");
    return (
      <MarkdownText text={text} containerStyle={!isFirst && styles.messagePartSpacing} />
    );
  }

  if (part.type === "approval") {
    return (
      <ApprovalTimelinePart
        part={part}
        isFirst={isFirst}
        onRespondApproval={onRespondApproval}
      />
    );
  }

  return <ActivityTimelinePart part={part} isFirst={isFirst} />;
}

function ActivityTimelinePart({
  part,
  isFirst
}: {
  part: Extract<ChatMessagePart, { type: "activity" }>;
  isFirst: boolean;
}) {
  const [detailsVisible, setDetailsVisible] = useState(false);
  const t = useTranslation();
  const tone = activityTone(part.status, t);
  const canOpenDetails = hasToolDetails(part);

  return (
    <View style={[styles.timelineRow, !isFirst && styles.messagePartSpacing]}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineNode, { backgroundColor: tone.color }]} />
      </View>
      <Pressable
        disabled={!canOpenDetails}
        onPress={() => setDetailsVisible(true)}
        style={[
          styles.timelineCard,
          canOpenDetails && styles.timelineCardPressable,
          { borderColor: tone.border, backgroundColor: tone.background }
        ]}
      >
        <View style={styles.timelineHeader}>
          <View style={styles.timelineTitleWrap}>
            <Terminal size={14} color={tone.color} />
            <Text numberOfLines={1} style={styles.timelineTitle}>
              {part.title}
            </Text>
          </View>
          <View style={[styles.timelineStatus, { backgroundColor: tone.pill }]}>
            {part.status === "running" ? <ActivityIndicator color={tone.color} size="small" /> : null}
            {part.status === "done" ? <Check size={12} color={tone.color} /> : null}
            {part.status === "failed" ? <X size={12} color={tone.color} /> : null}
            <Text style={[styles.timelineStatusText, { color: tone.color }]}>{tone.label}</Text>
          </View>
          {canOpenDetails ? <ChevronRight size={15} color={colors.textMuted} /> : null}
        </View>
      </Pressable>
      <ToolDetailsModal
        visible={detailsVisible}
        part={part}
        onClose={() => setDetailsVisible(false)}
      />
    </View>
  );
}

function ToolDetailsModal({
  visible,
  part,
  onClose
}: {
  visible: boolean;
  part: Extract<ChatMessagePart, { type: "activity" }>;
  onClose: () => void;
}) {
  const t = useTranslation();
  const sections = toolDetailSections(part, t);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.toolDetailsOverlay}>
        <View style={styles.toolDetailsPanel}>
          <View style={styles.toolDetailsHeader}>
            <View style={styles.toolDetailsTitleWrap}>
              <Text numberOfLines={1} style={styles.toolDetailsTitle}>{part.title}</Text>
              <Text style={styles.toolDetailsSubtitle}>{activityTone(part.status, t).label}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("message.closeToolDetails")}
              onPress={onClose}
              style={styles.toolDetailsClose}
            >
              <X size={18} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView style={styles.toolDetailsScroll} contentContainerStyle={styles.toolDetailsContent}>
            {sections.map((section) => (
              <ToolDetailsSection
                key={section.id}
                title={section.title}
                icon={section.icon}
                {...(section.tone ? { tone: section.tone } : {})}
              >
                {section.content}
              </ToolDetailsSection>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ToolDetailsSection({
  title,
  icon,
  tone,
  children
}: {
  title: string;
  icon: "terminal" | "file" | "code" | "alert";
  tone?: "danger";
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  const t = useTranslation();
  const Icon = icon === "file" ? FileCode2 : icon === "alert" ? AlertCircle : icon === "code" ? Code2 : Terminal;
  const color = tone === "danger" ? colors.danger : colors.accent;

  return (
    <View style={styles.toolDetailSection}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          expanded
            ? t("message.collapseSection", { title })
            : t("message.expandSection", { title })
        }
        onPress={() => setExpanded((current) => !current)}
        style={styles.toolDetailSectionHeader}
      >
        <Icon size={15} color={color} />
        <Text style={styles.toolDetailSectionTitle}>{title}</Text>
        {expanded ? <ChevronDown size={16} color={colors.textMuted} /> : <ChevronRight size={16} color={colors.textMuted} />}
      </Pressable>
      {expanded ? <View style={styles.toolDetailSectionBody}>{children}</View> : null}
    </View>
  );
}

function ApprovalTimelinePart({
  part,
  isFirst,
  onRespondApproval
}: {
  part: Extract<ChatMessagePart, { type: "approval" }>;
  isFirst: boolean;
  onRespondApproval: (approval: PendingApproval, decision: string) => void;
}) {
  const t = useTranslation();
  const approval = part.approval;
  const decisions = approval.available_decisions ?? ["accept", "decline", "cancel"];
  const isPending = part.status === "pending";

  return (
    <View style={[styles.timelineRow, !isFirst && styles.messagePartSpacing]}>
      <View style={styles.timelineRail}>
        <View style={[styles.timelineNode, { backgroundColor: colors.warning }]} />
      </View>
      <View style={[styles.timelineCard, styles.approvalTimelineCard]}>
        <View style={styles.timelineHeader}>
          <View style={styles.timelineTitleWrap}>
            <ShieldCheck size={14} color={colors.warning} />
            <Text style={styles.timelineTitle}>{t("message.approval")}</Text>
          </View>
          <View style={styles.approvalPendingPill}>
            <Text style={styles.approvalPendingText}>
              {isPending ? t("message.pending") : part.decision ?? t("message.answered")}
            </Text>
          </View>
        </View>
        <Text numberOfLines={3} style={styles.timelineDetail}>
          {approvalDetail(approval, t)}
        </Text>
        {isPending ? (
          <View style={styles.approvalActions}>
            {decisions.map((decision) => (
              <Pressable
                key={decision}
                onPress={() => onRespondApproval(approval, decision)}
                style={[
                  styles.approvalButton,
                  decision.startsWith("accept") ? styles.approvalAccept : styles.approvalDecline
                ]}
              >
                <Text
                  style={[
                    styles.approvalButtonText,
                    decision.startsWith("accept") ? styles.approvalAcceptText : styles.approvalDeclineText
                  ]}
                >
                  {decision}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function messageParts(message: ChatMessage): ChatMessagePart[] {
  if (message.parts && message.parts.length > 0) {
    return message.parts;
  }
  if (message.text.trim()) {
    return [
      {
        id: `${message.id}_text`,
        type: "text",
        text: message.text,
        ...(message.pending !== undefined ? { pending: message.pending } : {})
      }
    ];
  }
  return [];
}

function hasToolDetails(part: Extract<ChatMessagePart, { type: "activity" }>) {
  return Boolean(part.detail || part.output || part.toolDetails);
}

function toolDetailSections(part: Extract<ChatMessagePart, { type: "activity" }>, t: Translator) {
  const details = part.toolDetails ?? {};
  const sections: Array<{
    id: string;
    title: string;
    icon: "terminal" | "file" | "code" | "alert";
    tone?: "danger";
    content: React.ReactNode;
  }> = [];

  const command = formatCommand(details.command);
  if (command || details.cwd) {
    sections.push({
      id: "command",
      title: t("tool.command"),
      icon: "terminal",
      content: (
        <View style={styles.toolDetailRows}>
          {command ? <ToolCodeBlock text={command} /> : null}
          {typeof details.cwd === "string" ? (
            <ToolKeyValue label={t("tool.labelCwd")} value={details.cwd} />
          ) : null}
          {details.exitCode !== undefined ? (
            <ToolKeyValue label={t("tool.labelExitCode")} value={String(details.exitCode)} />
          ) : null}
          {details.durationMs !== undefined ? (
            <ToolKeyValue label={t("tool.labelDuration")} value={`${details.durationMs} ms`} />
          ) : null}
        </View>
      )
    });
  }

  const changes = Array.isArray(details.changes) ? details.changes : [];
  if (changes.length > 0) {
    sections.push({
      id: "changes",
      title: t("tool.fileChanges"),
      icon: "file",
      content: (
        <View style={styles.toolDetailRows}>
          {changes.map((change, index) => {
            const record = asRecord(change);
            const path = stringValue(record.path) ?? `Change ${index + 1}`;
            const kind = stringValue(record.kind);
            const diff = stringValue(record.diff);
            return (
              <View key={`${path}-${index}`} style={styles.toolChangeBlock}>
                <Text style={styles.toolChangePath}>{path}</Text>
                {kind ? <Text style={styles.toolChangeKind}>{kind}</Text> : null}
                {diff ? <ToolCodeBlock text={diff} /> : null}
              </View>
            );
          })}
        </View>
      )
    });
  }

  const diff = stringValue(details.diff);
  if (diff) {
    sections.push({
      id: "diff",
      title: t("tool.diff"),
      icon: "file",
      content: <ToolCodeBlock text={diff} />
    });
  }

  const output = stringValue(details.output) ?? part.output;
  if (output) {
    sections.push({
      id: "output",
      title: t("tool.output"),
      icon: "code",
      content: <ToolCodeBlock text={output} />
    });
  }

  if (details.error !== undefined || part.status === "failed") {
    sections.push({
      id: "error",
      title: t("tool.error"),
      icon: "alert",
      tone: "danger",
      content: <ToolCodeBlock text={formatValue(details.error ?? part.detail ?? t("tool.failed"))} />
    });
  }

  const metadata = metadataRows(details, t);
  if (metadata.length > 0) {
    sections.push({
      id: "metadata",
      title: t("tool.metadata"),
      icon: "code",
      content: (
        <View style={styles.toolDetailRows}>
          {metadata.map(([label, value]) => <ToolKeyValue key={label} label={label} value={value} />)}
        </View>
      )
    });
  }

  if (details.raw !== undefined) {
    sections.push({
      id: "raw",
      title: t("tool.rawEvent"),
      icon: "code",
      content: <ToolCodeBlock text={formatValue(details.raw)} />
    });
  }

  if (sections.length === 0) {
    sections.push({
      id: "summary",
      title: t("tool.summary"),
      icon: "code",
      content: <ToolCodeBlock text={part.detail ?? t("tool.noDetails")} />
    });
  }

  return sections;
}

function ToolCodeBlock({ text }: { text: string }) {
  return (
    <Text selectable style={styles.toolDetailCode}>
      {text || " "}
    </Text>
  );
}

function ToolKeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.toolKeyValueRow}>
      <Text style={styles.toolKey}>{label}</Text>
      <Text selectable style={styles.toolValue}>{value}</Text>
    </View>
  );
}

function metadataRows(details: Record<string, unknown>, t: Translator): Array<[string, string]> {
  return [
    [t("tool.labelKind"), stringValue(details.kind)],
    [t("tool.labelStatus"), stringValue(details.status)],
    [t("tool.labelServer"), stringValue(details.server)],
    [t("tool.labelTool"), stringValue(details.tool)],
    [t("tool.labelQuery"), stringValue(details.query)],
    [t("tool.labelSuccess"), details.success === undefined ? null : String(details.success)]
  ].filter((row): row is [string, string] => typeof row[1] === "string" && row[1].length > 0);
}

function formatCommand(command: unknown) {
  if (Array.isArray(command)) {
    return command.map((part) => String(part)).join(" ");
  }
  return stringValue(command);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function formatValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function deliveryTone(status: NonNullable<ChatMessage["deliveryStatus"]>, t: Translator) {
  if (status === "sending") {
    return {
      color: colors.warning,
      label: t("message.sending")
    };
  }
  if (status === "failed") {
    return {
      color: colors.danger,
      label: t("message.failed")
    };
  }
  return {
    color: colors.success,
    label: t("message.sent")
  };
}

function activityTone(
  status: Extract<ChatMessagePart, { type: "activity" }>["status"],
  t: Translator
) {
  if (status === "running") {
    return {
      color: colors.warning,
      border: "rgba(183, 110, 0, 0.22)",
      background: "rgba(255, 243, 214, 0.72)",
      pill: "rgba(183, 110, 0, 0.10)",
      label: t("activity.running")
    };
  }
  if (status === "failed") {
    return {
      color: colors.danger,
      border: "rgba(180, 35, 24, 0.22)",
      background: colors.dangerSoft,
      pill: "rgba(180, 35, 24, 0.10)",
      label: t("activity.failed")
    };
  }
  if (status === "done") {
    return {
      color: colors.success,
      border: "rgba(31, 122, 77, 0.20)",
      background: colors.successSoft,
      pill: "rgba(31, 122, 77, 0.10)",
      label: t("activity.done")
    };
  }
  return {
    color: colors.accent,
    border: "rgba(23, 107, 135, 0.18)",
    background: colors.accentSoft,
    pill: "rgba(23, 107, 135, 0.10)",
    label: t("activity.info")
  };
}

function approvalDetail(approval: PendingApproval, t: Translator) {
  if (approval.command) {
    return Array.isArray(approval.command) ? approval.command.join(" ") : approval.command;
  }
  return approval.reason ?? approval.method ?? approval.approval_type ?? t("message.approvalRequested");
}
