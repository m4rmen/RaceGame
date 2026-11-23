import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { messages } from "./messages";

const languages = { en: "English", fr: "Français", es: "Español" };
const storageKey = "aceRaceLanguage";
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (Object.prototype.hasOwnProperty.call(languages, saved)) return saved;
    } catch {
      // The selector still works if this browser blocks storage.
    }
    return "en";
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(storageKey, language);
    } catch {
      // Keep the current language in memory.
    }
  }, [language]);

  const value = useMemo(() => {
    function t(message, values = {}) {
      const translation = messages[message];
      const text =
        (language === "fr"
          ? translation?.[0]
          : language === "es"
            ? translation?.[1]
            : null) ?? message;
      return text.replace(/\{(\w+)\}/g, (token, key) => values[key] ?? token);
    }
    return { language, setLanguage, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <select
      className="language-select"
      aria-label={t("Language")}
      value={language}
      onChange={(event) => setLanguage(event.target.value)}
    >
      {Object.entries(languages).map(([code, name]) => (
        <option key={code} value={code} lang={code}>
          {name}
        </option>
      ))}
    </select>
  );
}

export function cardName(card, t) {
  const [suit, rank] = card.split("_");
  return t("{rank} of {suit}", { rank: t(rank), suit: t(suit) });
}

export function localizeError(message, t) {
  if (typeof message !== "string") return "";
  const distribution = /^You must distribute exactly (\d+) drink units\.$/.exec(
    message,
  );
  return distribution
    ? t("You must distribute exactly {count} drink units.", { count: distribution[1] })
    : t(message);
}
