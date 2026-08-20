(() => {
  "use strict";

  const theme = window.PS_AND_AS_SITE_THEME;
  if (!theme || !Array.isArray(theme.presets)) return;

  const KEYS = {
    felt: "@ps_and_as_wallpaper_tint",
    appearance: "@ps_and_as_appearance_mode",
    cards: "@ps_and_as_dark_mode_cards",
  };
  const root = document.documentElement;
  const table = document.querySelector("[data-tableau]");
  const setup = document.querySelector(".table-setup");
  const cardNodes = [...document.querySelectorAll("[data-preview-card]")];
  const feltButtons = [...document.querySelectorAll("[data-felt-option]")];
  const cardButtons = [...document.querySelectorAll("[data-card-mode]")];
  const appearanceButton = document.querySelector("[data-appearance-mode]");
  const setupStatus = document.querySelector("[data-setup-status]");
  const playLink = document.querySelector("[data-play-with-look]");
  const previewHint = document.querySelector("[data-preview-hint]");
  const hintTitle = previewHint?.querySelector("[data-hint-title]");
  const hintText = previewHint?.querySelector("[data-hint-text]");
  const media = window.matchMedia?.("(prefers-color-scheme: light)");
  let hoveredPreset = null;
  let hoveredDarkCards = null;
  let hoveredAppearance = null;
  let activeCard = null;
  let idleTimer = null;
  let carouselTimer = null;
  let carouselIndex = 0;

  const storage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch { /* Preview still works. */ }
    },
  };

  const findPreset = (value) =>
    theme.presets.find((preset) => preset.hex.toLowerCase() === String(value).toLowerCase()) ||
    theme.presets.find((preset) => preset.hex.toLowerCase() === theme.defaultFelt.toLowerCase()) ||
    theme.presets[0];

  const savedAppearance = storage.get(KEYS.appearance);
  const savedFelt = findPreset(storage.get(KEYS.felt) || theme.defaultFelt);
  feltButtons.forEach((button, index) => {
    const preset = theme.presets[index];
    if (preset) button.dataset.feltOption = preset.hex;
  });
  let state = {
    felt: savedFelt,
    appearance: savedAppearance === "light" || savedAppearance === "dark" ? savedAppearance : "system",
    darkCards: storage.get(KEYS.cards) === "1",
  };

  const cardHints = cardNodes.map((card, index) => {
    card.dataset.cardIndex = String(index);
    card.tabIndex = 0;

    const title = card.dataset.hintTitle || "Card detail";
    const text = card.dataset.hintText || "";
    card.setAttribute("aria-label", `${title}. ${text}`.trim());
    return { card, title, text };
  });
  activeCard = cardHints[0] || null;

  const showCardHint = ({ title, text }) => {
    if (hintTitle) hintTitle.textContent = title;
    if (hintText) hintText.textContent = text;
  };

  const resetCardHint = () => {
    const first = cardHints[0];
    if (first) showCardHint(first);
  };

  const setHoveredCard = (activeHint, schedule = true) => {
    activeCard = activeHint;
    carouselIndex = cardHints.indexOf(activeHint);
    cardHints.forEach(({ card }) => {
      card.classList.toggle("is-hovered", card === activeHint.card);
    });
    showCardHint(activeHint);
    if (schedule) scheduleIdleCarousel();
  };

  const nextAppearance = (appearance) =>
    appearance === "system" ? "light" : appearance === "light" ? "dark" : "system";

  const previewMode = () => hoveredAppearance || state.appearance;

  const scheduleIdleCarousel = () => {
    window.clearTimeout(idleTimer);
    window.clearInterval(carouselTimer);
    idleTimer = window.setTimeout(() => {
      carouselTimer = window.setInterval(() => {
        if (cardHints.length === 0) return;
        carouselIndex = (carouselIndex + 1) % cardHints.length;
        setHoveredCard(cardHints[carouselIndex], false);
      }, 8500);
    }, 10000);
  };

  const effectiveMode = () => {
    const appearance = previewMode();
    if (appearance !== "system") return appearance;
    return media?.matches ? "light" : "dark";
  };

  const render = () => {
    const mode = effectiveMode();
    const visualPreset = hoveredPreset || state.felt;
    const darkCards = hoveredDarkCards ?? state.darkCards;
    const cards = darkCards ? theme.cards.dark : theme.cards.light;
    const pageTint = `color-mix(in srgb, ${visualPreset.hex} 58%, transparent)`;
    root.dataset.previewMode = mode;
    root.dataset.previewCards = darkCards ? "dark" : "light";
    root.style.setProperty("--preview-felt", visualPreset.hex);
    root.style.setProperty("--preview-surface", visualPreset.surface);
    root.style.setProperty("--preview-accent", mode === "dark" ? visualPreset.accent : visualPreset.lightAccent);
    root.style.setProperty("--preview-accent-dim", visualPreset.accentDim);
    const surface = visualPreset.surfaces[mode];
    root.style.setProperty("--preview-glass-bg", surface.glass);
    root.style.setProperty("--preview-glass-border", surface.border);
    root.style.setProperty("--preview-glass-text", surface.text);
    root.style.setProperty("--preview-glass-control", surface.control);
    if (setup) {
      setup.style.backgroundColor = surface.glass;
      setup.style.borderColor = surface.border;
      setup.style.color = surface.text;
    }
    if (table) {
      table.style.backgroundColor = visualPreset.hex;
      const tint = `color-mix(in srgb, ${visualPreset.hex} 62%, transparent)`;
      table.style.backgroundImage = `linear-gradient(${tint}, ${tint}), linear-gradient(135deg, rgba(255,255,255,.05), transparent 45%), url("/ps_and_as/assets/felt_grey.webp")`;
      table.style.backgroundBlendMode = "normal";
      table.style.boxShadow = `var(--shadow), 0 0 36px color-mix(in srgb, ${mode === "dark" ? visualPreset.accent : visualPreset.lightAccent}, transparent 88%)`;
    }
    document.body.style.backgroundColor = visualPreset.hex;
    document.body.style.backgroundImage = `linear-gradient(rgba(8,10,10,.52), rgba(8,10,10,.52)), linear-gradient(${pageTint}, ${pageTint}), url("/ps_and_as/assets/felt_grey.webp")`;
    document.body.style.backgroundBlendMode = "normal";
    root.style.setProperty("--preview-card-bg", cards.faceBg);
    root.style.setProperty("--preview-card-black", cards.blackSuit);
    root.style.setProperty("--preview-card-red", cards.redSuit);
    root.style.setProperty("--preview-card-border", cards.faceBorder);
    feltButtons.forEach((button, index) => {
      const preset = theme.presets[index];
      if (preset) button.style.setProperty("--swatch", preset.hex);
    });
    cardNodes.forEach((node, index) => {
      node.style.backgroundColor = cards.faceBg;
      node.style.borderColor = cards.faceBorder;
      node.style.color = index % 2 === 0 ? cards.redSuit : cards.blackSuit;
      node.dataset.cards = darkCards ? "dark" : "light";
    });
    feltButtons.forEach((button) => {
      const selected = button.dataset.feltOption === state.felt.hex;
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
    });
    cardButtons.forEach((button) => {
      const selected = button.dataset.cardMode === (darkCards ? "dark" : "light");
      button.setAttribute("aria-pressed", String(selected));
      button.classList.toggle("is-selected", selected);
    });
    if (appearanceButton) appearanceButton.textContent = `Appearance: ${state.appearance}`;
    if (setupStatus) setupStatus.textContent = `${state.felt.name} · ${state.darkCards ? "Dark" : "Light"} cards · ${state.appearance} table`;
  };

  feltButtons.forEach((button) => button.addEventListener("click", () => {
    state.felt = findPreset(button.dataset.feltOption);
    hoveredPreset = null;
    render();
  }));
  feltButtons.forEach((button) => {
    const previewPreset = () => {
      hoveredPreset = findPreset(button.dataset.feltOption);
      render();
    };
    button.addEventListener("mouseenter", previewPreset);
    button.addEventListener("mouseleave", () => { hoveredPreset = null; render(); });
    button.addEventListener("focus", previewPreset);
    button.addEventListener("blur", () => { hoveredPreset = null; render(); });
  });
  cardButtons.forEach((button) => {
    const previewCards = () => {
      hoveredDarkCards = button.dataset.cardMode === "dark";
      render();
    };
    button.addEventListener("pointerenter", previewCards);
    button.addEventListener("focus", previewCards);
  });
  appearanceButton?.addEventListener("pointerenter", () => {
    hoveredAppearance = nextAppearance(state.appearance);
    render();
  });
  appearanceButton?.addEventListener("pointerleave", () => {
    hoveredAppearance = null;
    render();
  });
  appearanceButton?.addEventListener("focus", () => {
    hoveredAppearance = nextAppearance(state.appearance);
    render();
  });
  appearanceButton?.addEventListener("blur", () => {
    hoveredAppearance = null;
    render();
  });
  cardHints.forEach((hint) => {
    hint.card.addEventListener("pointerenter", () => setHoveredCard(hint));
    hint.card.addEventListener("focus", () => setHoveredCard(hint));
  });
  cardButtons.forEach((button) => button.addEventListener("click", () => {
    state.darkCards = button.dataset.cardMode === "dark";
    hoveredDarkCards = null;
    scheduleIdleCarousel();
    render();
  }));
  appearanceButton?.addEventListener("click", () => {
    state.appearance = nextAppearance(state.appearance);
    hoveredAppearance = null;
    scheduleIdleCarousel();
    render();
  });
  media?.addEventListener?.("change", render);
  playLink?.addEventListener("click", () => {
    storage.set(KEYS.felt, state.felt.hex);
    storage.set(KEYS.cards, state.darkCards ? "1" : "0");
    storage.set(KEYS.appearance, state.appearance);
  });
  setHoveredCard(cardHints[0]);
  scheduleIdleCarousel();
  render();
})();
