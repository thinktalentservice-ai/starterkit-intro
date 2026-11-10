import { useContext } from "react";
import { IntroContext } from "./context";
import type { IntroContextValue } from "./types";

export function useIntro(): IntroContextValue {
  const value = useContext(IntroContext);
  if (!value) {
    throw new Error("useIntro() must be used inside <IntroProvider>. Wrap your app (or layout) in <IntroProvider pathname baseUrl>.");
  }
  return value;
}
