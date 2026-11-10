import { createContext } from "react";
import type { IntroContextValue } from "./types";

export const IntroContext = createContext<IntroContextValue | null>(null);
