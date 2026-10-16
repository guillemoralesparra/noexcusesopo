"use client";

import { createContext, useContext } from "react";
import { DICTS, type Lang } from "@/lib/i18n";

const LangContext = createContext<Lang>("ca");

export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useT() {
  return DICTS[useContext(LangContext)];
}
