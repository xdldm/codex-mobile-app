// Formatting helpers for the account limits UI (the composer menu detail line,
// the limits modal meters, and credit/reset labels). Pure presentation logic.

import type { CodexAccountResponse, RateLimitSnapshot, RateLimitWindow } from "../../domain/bridge";
import type { DeepSeekBalance } from "../../domain/bridge";
import type { Translator } from "../../i18n";

export function limitsMenuDetail(bridge: {
  account: CodexAccountResponse | null;
  accountError: string | null;
  isRefreshingAccount: boolean;
  deepSeekBalance?: DeepSeekBalance | null;
}, t: Translator) {
  if (bridge.isRefreshingAccount) {
    return t("limits.refreshingMenu");
  }
  if (bridge.accountError) {
    return t("limits.needsAttention");
  }

  const balance = bridge.deepSeekBalance;
  if (balance?.available) {
    return t("limits.deepseekMenu", { amount: formatBalanceAmount(balance) });
  }
  const limits = getCodexLimits(bridge.account);
  const summary = windowSummary(limits, t);
  if (summary) {
    return summary;
  }

  const planType = limits?.planType ?? bridge.account?.account?.planType;
  return planType ? planTypeLabel(planType) : t("limits.usage");
}

/** "¥15.39" — currency symbol plus the provider's own decimal string. */
export function formatBalanceAmount(balance: DeepSeekBalance) {
  const symbol = (balance.currency ?? "CNY").toUpperCase() === "USD" ? "$" : "¥";
  return `${symbol}${balance.total_balance ?? "0"}`;
}

/**
 * "5h 剩 72% · 每周 45%" — the menu row should be enough to judge headroom
 * without opening the modal.
 */
function windowSummary(limits: RateLimitSnapshot | null, t: Translator) {
  if (!limits) {
    return null;
  }

  const parts = [limits.primary, limits.secondary]
    .filter((window): window is RateLimitWindow => Boolean(window))
    .map(
      (window) =>
        `${shortWindowLabel(window.windowDurationMins, t)} ${t("limits.remaining", {
          percent: clampPercent(100 - window.usedPercent)
        })}`
    );

  return parts.length > 0 ? parts.join(" · ") : null;
}

function shortWindowLabel(minutes: number | null, t: Translator) {
  if (minutes === 300) {
    return t("limits.fiveHourShort");
  }
  if (minutes === 10080) {
    return t("limits.weeklyShort");
  }
  return t("limits.currentWindow");
}

export function getCodexLimits(account: CodexAccountResponse | null): RateLimitSnapshot | null {
  return account?.rateLimits?.rateLimitsByLimitId?.codex ?? account?.rateLimits?.rateLimits ?? null;
}

export function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function formatPercent(value: number) {
  return `${clampPercent(value)}%`;
}

export function windowDurationLabel(minutes: number | null) {
  if (minutes === 300) {
    return "5h window";
  }
  if (minutes === 10080) {
    return "Weekly window";
  }
  if (!minutes) {
    return "Current window";
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60}h window`;
  }
  return `${minutes} min window`;
}

export function resetLabel(resetsAt: number | null) {
  if (!resetsAt) {
    return "Reset not reported";
  }

  const milliseconds = resetsAt > 10_000_000_000 ? resetsAt : resetsAt * 1000;
  const formatted = new Date(milliseconds).toLocaleString("en-US", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  return `Reset ${formatted}`;
}

export function planTypeLabel(planType: string) {
  return planType.replace(/_/g, " ");
}

export function creditsLabel(
  credits: NonNullable<RateLimitSnapshot["credits"]>,
  t: Translator
) {
  if (credits.unlimited) {
    return t("limits.unlimited");
  }
  if (credits.balance) {
    return credits.balance;
  }
  return credits.hasCredits ? "Active" : "Unavailable";
}

export function limitReachedLabel(rateLimitReachedType: string) {
  return rateLimitReachedType.replace(/_/g, " ");
}
