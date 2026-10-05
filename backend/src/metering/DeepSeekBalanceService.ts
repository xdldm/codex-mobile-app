import fs from "node:fs";

export type DeepSeekBalance = {
  available: boolean;
  reason?: string;
  is_available?: boolean;
  currency?: string;
  total_balance?: string;
  granted_balance?: string;
  topped_up_balance?: string;
  fetched_at: string;
};

const CACHE_MS = 30_000;

/**
 * Reads the DeepSeek account balance for the provider the bridge runs on.
 * The key stays on the host (env var first, then a mode-600 file); it is never
 * sent to the mobile app.
 */
export class DeepSeekBalanceService {
  private cached: DeepSeekBalance | null = null;
  private cachedAt = 0;

  constructor(
    private readonly options: { keyFile: string; baseUrl: string; env?: NodeJS.ProcessEnv }
  ) {}

  async balance(force = false): Promise<DeepSeekBalance> {
    const now = Date.now();
    if (!force && this.cached && now - this.cachedAt < CACHE_MS) {
      return this.cached;
    }

    const result = await this.fetchBalance();
    this.cached = result;
    this.cachedAt = now;
    return result;
  }

  private async fetchBalance(): Promise<DeepSeekBalance> {
    const fetchedAt = new Date().toISOString();
    const apiKey = this.apiKey();
    if (!apiKey) {
      return {
        available: false,
        reason: `No DeepSeek API key: set DEEPSEEK_API_KEY or write ${this.options.keyFile}.`,
        fetched_at: fetchedAt
      };
    }

    try {
      const response = await fetch(new URL("/user/balance", this.options.baseUrl), {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(10_000)
      });

      if (!response.ok) {
        return {
          available: false,
          reason:
            response.status === 401 || response.status === 403
              ? "DeepSeek rejected the API key."
              : `DeepSeek balance request failed with ${response.status}.`,
          fetched_at: fetchedAt
        };
      }

      const payload = (await response.json()) as {
        is_available?: boolean;
        balance_infos?: Array<{
          currency?: string;
          total_balance?: string;
          granted_balance?: string;
          topped_up_balance?: string;
        }>;
      };
      const info = payload.balance_infos?.[0];

      return {
        available: true,
        is_available: payload.is_available ?? true,
        currency: info?.currency ?? "CNY",
        total_balance: info?.total_balance ?? "0",
        granted_balance: info?.granted_balance ?? "0",
        topped_up_balance: info?.topped_up_balance ?? "0",
        fetched_at: fetchedAt
      };
    } catch (error) {
      return {
        available: false,
        reason: error instanceof Error ? error.message : "DeepSeek balance request failed.",
        fetched_at: fetchedAt
      };
    }
  }

  private apiKey() {
    const fromEnv = (this.options.env ?? process.env).DEEPSEEK_API_KEY?.trim();
    if (fromEnv) {
      return fromEnv;
    }

    try {
      return fs.readFileSync(this.options.keyFile, "utf8").trim() || null;
    } catch {
      return null;
    }
  }
}
