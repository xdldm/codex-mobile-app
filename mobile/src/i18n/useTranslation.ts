import { useMemo } from "react";

import { useBridge } from "../state/BridgeProvider";
import { createTranslator, type Translator } from "./index";

/**
 * Returns `t` for the language the user picked in settings (or their phone
 * language when the preference is "system").
 */
export function useTranslation(): Translator {
  const { language } = useBridge();
  return useMemo(() => createTranslator(language), [language]);
}
