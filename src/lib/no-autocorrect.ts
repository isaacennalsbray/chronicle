/**
 * Spread onto a text box for names and codes ("S15", "Eldar", "9th of Tenthmoon") so the
 * browser and phone keyboards don't "fix" them, capitalise them or offer past entries.
 */
export const NO_AUTOCORRECT = {
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
} as const;
