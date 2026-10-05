import { router } from "expo-router";
import {
  FolderPlus,
  FolderGit2,
  ListTree,
  MessageSquarePlus,
  Paperclip,
  RefreshCcw,
  Send,
  Settings,
  Square,
  X
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconAction } from "../components/IconAction";
import { Screen } from "../components/Screen";
import { StatusPill } from "../components/StatusPill";
import type { ChatMessage } from "../domain/bridge";
import { attachmentInputItems, messageForDraft } from "../domain/attachments";
import { activeMentionTrigger, buildMentionItems, type ComposerMention } from "../domain/mentions";
import { useTranslation } from "../i18n/useTranslation";
import { useBridge } from "../state/BridgeProvider";
import { colors, spacing } from "../theme/colors";
import { compactPath } from "../utils/format";
import { ComposerMenu } from "./home/ComposerMenu";
import { EmptyChat } from "./home/EmptyChat";
import { FolderPickerModal } from "./home/FolderPickerModal";
import { LimitsModal } from "./home/LimitsModal";
import { MentionPalette } from "./home/MentionPalette";
import { MessageBubble } from "./home/MessageBubble";
import { styles } from "./home/styles";

// How close to the bottom still counts as "following the conversation".
const BOTTOM_STICKY_THRESHOLD = 64;

export function HomeScreen() {
  const bridge = useBridge();
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<ComposerMention[]>([]);
  const [limitsVisible, setLimitsVisible] = useState(false);
  const [folderPickerVisible, setFolderPickerVisible] = useState(false);
  const messageListRef = useRef<FlatList<ChatMessage> | null>(null);
  const mentionLoadRequested = useRef(false);
  // Sticky bottom: follow new output only while the user is already at the
  // bottom, so reading earlier messages is not interrupted by auto-scrolling.
  const stickToBottom = useRef(true);
  // Set whenever the list must land on the newest message after a layout change
  // (thread switch, app resumed, list re-measured).
  const pendingBottomScroll = useRef(true);
  const selectedModel = useMemo(
    () => bridge.models.find((model) => model.id === bridge.selectedModelId) ?? null,
    [bridge.models, bridge.selectedModelId]
  );
  const canSend =
    (draft.trim().length > 0 || bridge.pendingAttachments.length > 0) &&
    !bridge.isRunning &&
    !bridge.isComposerLocked &&
    Boolean(bridge.selectedWorkspace);
  const mentionTrigger = useMemo(() => activeMentionTrigger(draft), [draft]);
  const mentionItems = useMemo(
    () =>
      buildMentionItems(
        bridge.apps,
        bridge.skills,
        bridge.mcpServers,
        mentionTrigger?.query ?? ""
      ),
    [bridge.apps, bridge.skills, bridge.mcpServers, mentionTrigger?.query]
  );
  // With the keyboard open on Android the stack is already lifted to the keyboard top
  // (KeyboardAvoidingView paddingBottom), so the composer only needs its own breathing room —
  // symmetric with the composer's top padding. When closed it clears the navigation bar inset.
  const composerBottomPadding =
    Platform.OS === "android" && keyboardVisible ? spacing.md : spacing.md + insets.bottom;
  const latestMessageMarker = useMemo(() => {
    const last = bridge.messages[bridge.messages.length - 1];
    if (!last) {
      return "empty";
    }
    const partMarker = last.parts
      ?.map((part) => {
        if (part.type === "text") {
          return `${part.id}:${part.text.length}:${part.pending ? "p" : "d"}`;
        }
        if (part.type === "activity") {
          return `${part.id}:${part.status}:${part.detail ?? ""}:${part.output?.length ?? 0}`;
        }
        return `${part.id}:${part.status}:${part.decision ?? ""}`;
      })
      .join("|");
    return `${last.id}:${last.text.length}:${last.pending ? "p" : "d"}:${partMarker ?? ""}`;
  }, [bridge.messages]);

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      messageListRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // A new conversation always starts pinned to the newest message, even if the
  // user had scrolled up in the previous one.
  useEffect(() => {
    stickToBottom.current = true;
    pendingBottomScroll.current = true;
  }, [bridge.selectedThread?.id, bridge.selectedWorkspace?.path]);

  // Sending re-pins the list: the answer is what the user wants to watch.
  const lastMessage = bridge.messages[bridge.messages.length - 1];
  const lastMessageId = lastMessage?.id ?? null;
  const lastMessageRole = lastMessage?.role ?? null;
  useEffect(() => {
    if (lastMessageRole === "user") {
      stickToBottom.current = true;
    }
  }, [lastMessageId, lastMessageRole]);

  useEffect(() => {
    if (bridge.messages.length === 0 || !stickToBottom.current) {
      return;
    }

    scrollToBottom(true);
  }, [bridge.messages.length, latestMessageMarker, scrollToBottom]);

  // Coming back from the background has to land on the newest message: the list
  // was detached from the layout while the app was away and stopped following.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        return;
      }

      pendingBottomScroll.current = true;
      if (stickToBottom.current) {
        scrollToBottom(false);
      }
    });

    return () => subscription.remove();
  }, [scrollToBottom]);

  const applyStickyBottom = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    stickToBottom.current = distanceFromBottom <= BOTTOM_STICKY_THRESHOLD;
    if (stickToBottom.current) {
      pendingBottomScroll.current = false;
    }
  }, []);

  const userScrolling = useRef(false);
  const handleScrollBegin = useCallback(() => {
    userScrolling.current = true;
  }, []);
  const handleMessageScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // Only the user's gestures decide whether the list keeps following the
      // conversation; offset changes we caused ourselves must not flip it.
      if (userScrolling.current) {
        applyStickyBottom(event);
      }
    },
    [applyStickyBottom]
  );
  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      // A fling keeps moving after the finger lifts, so judge the position it
      // actually settled on.
      applyStickyBottom(event);
      userScrolling.current = false;
    },
    [applyStickyBottom]
  );

  useEffect(() => {
    if (Platform.OS !== "android") {
      return undefined;
    }

    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      Keyboard.scheduleLayoutAnimation(event);
      // height excludes the navigation bar (RN reports imeInsets.bottom - barInsets.bottom).
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
      setKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", (event) => {
      Keyboard.scheduleLayoutAnimation(event);
      setKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    mentionLoadRequested.current = false;
  }, [bridge.selectedWorkspace?.path, bridge.selectedThread?.id]);

  useEffect(() => {
    if (!mentionTrigger || mentionLoadRequested.current) {
      return;
    }

    mentionLoadRequested.current = true;
    void bridge.refreshMentions();
  }, [bridge, mentionTrigger]);

  const handleDraftChange = (next: string) => {
    setDraft(next);
    setSelectedMentions((current) => current.filter((mention) => next.includes(mention.token)));
  };

  const handleMentionSelect = (mention: ComposerMention) => {
    const trigger = activeMentionTrigger(draft);
    if (!trigger) {
      return;
    }

    const nextDraft = `${draft.slice(0, trigger.start)}${mention.token} ${draft.slice(trigger.end)}`;
    setDraft(nextDraft);
    setSelectedMentions((current) =>
      current.some((item) => item.id === mention.id) ? current : [...current, mention]
    );
  };

  const removeMention = (mention: ComposerMention) => {
    setSelectedMentions((current) => current.filter((item) => item.id !== mention.id));
    setDraft((current) => current.replace(mention.token, "").replace(/\s{2,}/g, " "));
  };

  const handleSend = () => {
    const attachments = bridge.pendingAttachments;
    const value = messageForDraft(draft, attachments.length, t);
    const inputItems = [
      ...selectedMentions.map((mention) => mention.inputItem),
      ...attachmentInputItems(attachments)
    ];
    setDraft("");
    setSelectedMentions([]);
    void bridge.sendMessage(value, inputItems);
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        // Android (edge-to-edge + adjustResize) does not resize the root view; RN only emits
        // keyboard events. Avoid behavior="height": its self-referential reset can stick a stale
        // offset after the keyboard closes. Instead lift the stack deterministically by the measured
        // keyboard height (+ the navigation-bar inset it overlaps), gated on keyboardVisible so it
        // resets to zero on keyboardDidHide / blur. iOS keeps the reliable padding behavior.
        behavior={Platform.select({ ios: "padding", default: undefined })}
        style={[
          styles.keyboard,
          Platform.OS === "android" && keyboardVisible
            ? { paddingBottom: keyboardHeight + insets.bottom }
            : null
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.appTitle}>Codex Mobile</Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {bridge.selectedWorkspace ? compactPath(bridge.selectedWorkspace.path) : "No repository"}
            </Text>
          </View>
          <StatusPill
            label={bridge.health?.codex_ready ? "online" : "offline"}
            tone={bridge.health?.codex_ready ? "ok" : bridge.error ? "error" : "warn"}
          />
          <IconAction
            icon={FolderGit2}
            label={t("home.repositories")}
            onPress={() => router.push("/repositories")}
          />
          <IconAction icon={RefreshCcw} label={t("common.refresh")} onPress={() => void bridge.refreshAll()} />
          <IconAction icon={Settings} label={t("home.settings")} onPress={() => router.push("/settings")} />
        </View>

        <LimitsModal visible={limitsVisible} onClose={() => setLimitsVisible(false)} />
        <FolderPickerModal visible={folderPickerVisible} onClose={() => setFolderPickerVisible(false)} />

        {bridge.error ? (
          <View style={styles.errorBand}>
            <Text numberOfLines={2} style={styles.errorText}>
              {bridge.error}
            </Text>
          </View>
        ) : null}

        <View style={styles.threadBar}>
          <Pressable style={styles.threadButton} onPress={() => router.push("/conversations")}>
            <ListTree size={18} color={colors.text} />
            <View style={styles.threadTextWrap}>
              <Text numberOfLines={1} style={styles.threadTitle}>
                {bridge.selectedThread?.title ?? t("home.newConversation")}
              </Text>
              <Text numberOfLines={1} style={styles.threadSubtitle}>
                {bridge.threads.length} conversations in this repository
              </Text>
            </View>
          </Pressable>
          <View style={styles.threadActions}>
            <IconAction
              icon={MessageSquarePlus}
              label={t("home.newConversation")}
              onPress={() => void bridge.createNewThread()}
            />
            <IconAction
              icon={FolderPlus}
              label={t("home.addFolder")}
              onPress={() => setFolderPickerVisible(true)}
            />
          </View>
        </View>

        <FlatList
          ref={messageListRef}
          data={bridge.messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              onRespondApproval={(approval, decision) => void bridge.respondApproval(approval, decision)}
            />
          )}
          contentContainerStyle={styles.messageList}
          style={styles.messages}
          onScroll={handleMessageScroll}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollBegin={handleScrollBegin}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          onContentSizeChange={() => {
            // Only correct the position when the layout changed out from under
            // us (thread switch, resume, first measure); streamed output is
            // followed by the effect above.
            if (!stickToBottom.current || !pendingBottomScroll.current) {
              return;
            }
            pendingBottomScroll.current = false;
            scrollToBottom(false);
          }}
          ListEmptyComponent={
            <EmptyChat
              isLoading={bridge.isLoadingThreadContent}
              hasSelectedThread={Boolean(bridge.selectedThread)}
              hasWorkspace={Boolean(bridge.selectedWorkspace)}
            />
          }
        />

        {mentionTrigger ? (
          <MentionPalette
            items={mentionItems}
            query={mentionTrigger.query}
            loading={bridge.isRefreshingMentions}
            error={bridge.mentionError}
            onRefresh={() => void bridge.refreshMentions()}
            onSelect={handleMentionSelect}
          />
        ) : null}

        <View style={[styles.composer, { paddingBottom: composerBottomPadding }]}>
          {bridge.attachmentError ? (
            <Text numberOfLines={2} style={styles.composerError}>
              {bridge.attachmentError}
            </Text>
          ) : null}
          <View style={styles.composerRow}>
            <ComposerMenu
              selectedModel={selectedModel}
              onOpenLimits={() => {
                setLimitsVisible(true);
                void bridge.refreshAccount();
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("home.attachFile")}
              disabled={bridge.isUploadingAttachment}
              onPress={() => void bridge.attachFile()}
              style={({ pressed }) => [
                styles.composerMenuButton,
                (pressed || bridge.isUploadingAttachment) && styles.composerMenuButtonPressed
              ]}
            >
              {bridge.isUploadingAttachment ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Paperclip size={18} color={colors.textMuted} />
              )}
            </Pressable>
            <View style={styles.composerInputWrap}>
              {selectedMentions.length > 0 || bridge.pendingAttachments.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mentionChips}>
                  {bridge.pendingAttachments.map((attachment) => (
                    <Pressable
                      key={attachment.id}
                      onPress={() => bridge.removeAttachment(attachment.id)}
                      style={({ pressed }) => [
                        styles.attachmentChip,
                        pressed && styles.menuItemPressed
                      ]}
                    >
                      <Paperclip size={12} color={colors.textMuted} />
                      <Text numberOfLines={1} style={styles.attachmentChipText}>
                        {attachment.name}
                      </Text>
                      <X size={12} color={colors.textMuted} />
                    </Pressable>
                  ))}
                  {selectedMentions.map((mention) => (
                    <Pressable
                      key={mention.id}
                      onPress={() => removeMention(mention)}
                      style={({ pressed }) => [styles.mentionChip, pressed && styles.menuItemPressed]}
                    >
                      <Text numberOfLines={1} style={styles.mentionChipText}>
                        {mention.token}
                      </Text>
                      <X size={12} color={colors.accent} />
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              <TextInput
                value={draft}
                onChangeText={handleDraftChange}
                multiline
                placeholder={t("home.messagePlaceholder")}
                placeholderTextColor={colors.textSubtle}
                onBlur={() => setKeyboardVisible(false)}
                onFocus={() => {
                  if (Platform.OS === "android" && Keyboard.isVisible()) {
                    setKeyboardVisible(true);
                  }
                }}
                style={styles.input}
              />
            </View>
            {bridge.isRunning ? (
              <IconAction
                icon={Square}
                label={t("home.cancelRun")}
                variant="danger"
                onPress={() => void bridge.cancelRun()}
              />
            ) : (
              <IconAction
                icon={Send}
                label={t("home.send")}
                variant="filled"
                disabled={!canSend}
                onPress={handleSend}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
