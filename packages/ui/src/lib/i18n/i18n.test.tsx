import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider, formatNumber, translate, useI18n } from "./i18n.js";

function Page() {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <h1>{t("settings.label")}</h1>
      <span>{locale}</span>
      <button type="button" onClick={() => setLocale("sv")}>
        to-sv
      </button>
      <button type="button" onClick={() => setLocale("en")}>
        to-en
      </button>
    </div>
  );
}

describe("i18n", () => {
  it("switches the settings label between en and sv", () => {
    render(
      <I18nProvider>
        <Page />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading").textContent).toBe("Settings");
    fireEvent.click(screen.getByText("to-sv"));
    expect(screen.getByRole("heading").textContent).toBe("Inställningar");
    fireEvent.click(screen.getByText("to-en"));
    expect(screen.getByRole("heading").textContent).toBe("Settings");
  });

  it("accepts custom catalogues, regional locales, params and fallback", () => {
    const c = { sv: { hi: "Hej {name}" }, en: { hi: "Hi {name}" } };
    expect(translate(c, "sv-SE", "hi", { name: "Ada" })).toBe("Hej Ada");
    expect(translate(c, "de", "hi", { name: "Ada" })).toBe("Hi Ada");
    expect(translate(c, "en", "missing")).toBe("missing");
  });

  it("formats numbers per locale", () => {
    expect(formatNumber("en", 1234.5)).toBe("1,234.5");
  });
});
