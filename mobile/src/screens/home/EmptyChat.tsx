import { ActivityIndicator, Text, View } from "react-native";

import { useTranslation } from "../../i18n/useTranslation";
import { colors } from "../../theme/colors";
import { styles } from "./styles";

export function EmptyChat({
  isLoading,
  hasSelectedThread,
  hasWorkspace
}: {
  isLoading: boolean;
  hasSelectedThread: boolean;
  hasWorkspace: boolean;
}) {
  const t = useTranslation();
  const title = isLoading
    ? t("empty.loading")
    : hasSelectedThread
      ? t("empty.noMessages")
      : t("empty.newConversation");
  const text = isLoading
    ? t("empty.fetchingHistory")
    : hasSelectedThread
      ? t("empty.noTurns")
      : hasWorkspace
        ? t("empty.sendToCreate")
        : t("empty.chooseRepository");

  return (
    <View style={styles.empty}>
      {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}
