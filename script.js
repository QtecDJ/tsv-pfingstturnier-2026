(() => {
  // Countdown zum ersten Turniertag. Die Werte bleiben bewusst im Markup,
  // damit die Turnierleitung das Datum spaeter leicht anpassen kann.
  const countdown = document.querySelector("[data-countdown]");
  const countdownLabel = document.querySelector("[data-countdown-label]");
  const liveTicker = document.querySelector("[data-live-ticker]");
  const time = {
    day: 1000 * 60 * 60 * 24,
    hour: 1000 * 60 * 60,
    minute: 1000 * 60,
  };
  let liveTickerLoadedAt = 0;

  function writeCountdownValue(selector, value) {
    const node = countdown?.querySelector(selector);
    if (node) node.textContent = value;
  }

  function updateCountdown() {
    if (!countdown) return;

    const target = new Date(countdown.dataset.countdown).getTime();
    const now = Date.now();
    const distance = Math.max(0, target - now);

    writeCountdownValue("[data-days]", Math.floor(distance / time.day));
    writeCountdownValue("[data-hours]", Math.floor((distance % time.day) / time.hour));
    writeCountdownValue("[data-minutes]", Math.floor((distance % time.hour) / time.minute));
    writeCountdownValue("[data-seconds]", Math.floor((distance % time.minute) / 1000));

    if (distance === 0) showLiveTicker(now);
  }

  function scoreText(match) {
    const home = Number.isFinite(match.homeGoals) ? match.homeGoals : "-";
    const away = Number.isFinite(match.awayGoals) ? match.awayGoals : "-";
    return `${home} : ${away}`;
  }

  function formatTickerTime(value) {
    if (!value) return "";
    return new Intl.DateTimeFormat("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function pickTickerMatch(matches, now) {
    const sorted = [...matches].sort((a, b) => new Date(a.time) - new Date(b.time));
    const live = sorted.find((match) => {
      const start = new Date(match.time).getTime();
      const end = start + 60 * 60 * 1000;
      return match.status === "live" || (now >= start && now <= end);
    });

    return live || sorted.find((match) => new Date(match.time).getTime() >= now) || sorted.at(-1);
  }

  function writeLiveTicker(data) {
    if (!liveTicker) return;

    const matches = Array.isArray(data.matches) ? data.matches : [];
    const match = pickTickerMatch(matches, Date.now()) || {};
    const status = liveTicker.querySelector("[data-live-status]");
    const home = liveTicker.querySelector("[data-live-home]");
    const away = liveTicker.querySelector("[data-live-away]");
    const score = liveTicker.querySelector("[data-live-score]");
    const note = liveTicker.querySelector("[data-live-note]");
    const updated = liveTicker.querySelector("[data-live-updated]");

    const isLive = match.status === "live";
    status.textContent = isLive ? "Live" : "Ticker bereit";
    home.textContent = match.home || "Spielplan";
    away.textContent = match.away || "folgt";
    score.textContent = scoreText(match);
    note.textContent = match.note || data.message || "Sobald echte Ergebnisse vorliegen, werden sie hier angezeigt.";
    updated.textContent = data.lastUpdated
      ? `Stand: ${formatTickerTime(data.lastUpdated)} | Quelle: TSV Plattenhardt`
      : "Quelle: TSV Plattenhardt";
  }

  async function loadLiveTicker(force = false) {
    if (!liveTicker) return;
    const now = Date.now();
    if (!force && now - liveTickerLoadedAt < 30000) return;
    liveTickerLoadedAt = now;

    try {
      const response = await fetch(`liveticker.json?v=${Math.floor(now / 30000)}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Live-Ticker konnte nicht geladen werden.");
      writeLiveTicker(await response.json());
    } catch (error) {
      writeLiveTicker({
        lastUpdated: new Date().toISOString(),
        message: "Der Live-Ticker ist vorbereitet, die Ergebnisdatei konnte gerade aber nicht geladen werden.",
        matches: [{ home: "Live-Ticker", away: "wartet", homeGoals: null, awayGoals: null }],
      });
    }
  }

  function showLiveTicker(now) {
    if (!liveTicker) return;
    countdown.hidden = true;
    liveTicker.hidden = false;
    if (countdownLabel) countdownLabel.textContent = "Live am Weilerhau";
    loadLiveTicker(now === undefined);
  }

  function activatePanel(tab) {
    const targetPanel = document.getElementById(tab.dataset.day);
    if (!targetPanel) return;

    document.querySelectorAll(".tab").forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".fixtures").forEach((panel) => {
      panel.classList.remove("active");
      panel.hidden = true;
    });

    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    targetPanel.classList.add("active");
    targetPanel.hidden = false;
  }

  function protectVisualAssets() {
    // Kleiner Frontend-Schutz fuer Logos und Eventgrafiken. Geheim wird HTML dadurch
    // natuerlich nicht, aber versehentliches Ziehen/Speichern im Alltag wird reduziert.
    document.querySelectorAll("img, .team-card, .match-card").forEach((item) => {
      item.setAttribute("draggable", "false");
      item.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }

  function setupMobileMenu() {
    const button = document.querySelector(".menu-toggle");
    const menu = document.getElementById("mobile-menu");
    if (!button || !menu) return;

    function setMenuState(isOpen) {
      button.setAttribute("aria-expanded", String(isOpen));
      button.setAttribute("aria-label", isOpen ? "Menue schliessen" : "Menue oeffnen");
      menu.hidden = !isOpen;
    }

    button.addEventListener("click", () => {
      setMenuState(button.getAttribute("aria-expanded") !== "true");
    });

    menu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => setMenuState(false));
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setMenuState(false);
    });
  }

  function setupScrollTop() {
    const button = document.querySelector(".scroll-top");
    if (!button) return;

    function updateButton() {
      const shouldShow = window.scrollY > 520;
      button.hidden = false;
      button.classList.toggle("is-visible", shouldShow);
    }

    button.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    updateButton();
    window.addEventListener("scroll", updateButton, { passive: true });
  }

  function setupAccessibilityTools() {
    const panel = document.querySelector("[data-accessibility-panel]");
    const toggle = document.querySelector("[data-accessibility-toggle]");
    const reset = document.querySelector("[data-accessibility-reset]");
    const readButton = document.querySelector("[data-read-page]");
    const stopButton = document.querySelector("[data-stop-reading]");
    const status = document.querySelector("[data-accessibility-status]");
    const options = document.querySelectorAll("[data-accessibility-option]");
    if (!panel || !toggle) return;

    const classNames = {
      largeText: "accessibility-large-text",
      highContrast: "accessibility-high-contrast",
      reducedMotion: "accessibility-reduced-motion",
    };
    const storageKey = "tsv-accessibility";
    let readingWasStopped = false;

    function readSettings() {
      try {
        return JSON.parse(localStorage.getItem(storageKey)) || {};
      } catch (error) {
        return {};
      }
    }

    function writeSettings(settings) {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    }

    function applySettings(settings) {
      Object.entries(classNames).forEach(([key, className]) => {
        document.body.classList.toggle(className, Boolean(settings[key]));
      });

      options.forEach((input) => {
        input.checked = Boolean(settings[input.dataset.accessibilityOption]);
      });
    }

    function setPanelState(isOpen) {
      panel.hidden = !isOpen;
      toggle.setAttribute("aria-expanded", String(isOpen));
    }

    function announce(message) {
      if (status) status.textContent = message;
    }

    function readableText() {
      const main = document.querySelector("main");
      if (!main) return "";

      return [...main.querySelectorAll("h1, h2, h3, p, time, .eyebrow, .team-card h4, .match-team b")]
        .map((node) => node.textContent.trim())
        .filter(Boolean)
        .join(". ")
        .replace(/\s+/g, " ");
    }

    function startReading() {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        announce("Die Vorlese-Funktion wird von diesem Browser nicht unterstuetzt.");
        return;
      }

      const text = readableText();
      if (!text) {
        announce("Es wurde kein lesbarer Seiteninhalt gefunden.");
        return;
      }

      window.speechSynthesis.cancel();
      readingWasStopped = false;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "de-DE";
      utterance.rate = 0.95;
      announce("Vorlesen wird vorbereitet.");
      utterance.onstart = () => announce("Vorlesen gestartet.");
      utterance.onend = () => announce("Vorlesen beendet.");
      utterance.onerror = () => {
        if (!readingWasStopped) announce("Vorlesen konnte nicht gestartet werden.");
      };
      window.speechSynthesis.speak(utterance);
    }

    function stopReading() {
      readingWasStopped = true;
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      announce("Vorlesen gestoppt.");
    }

    let settings = readSettings();
    applySettings(settings);

    toggle.addEventListener("click", () => {
      setPanelState(toggle.getAttribute("aria-expanded") !== "true");
    });

    options.forEach((input) => {
      input.addEventListener("change", () => {
        settings = { ...settings, [input.dataset.accessibilityOption]: input.checked };
        writeSettings(settings);
        applySettings(settings);
      });
    });

    reset?.addEventListener("click", () => {
      settings = {};
      localStorage.removeItem(storageKey);
      applySettings(settings);
      announce("Barrierefreiheits-Einstellungen wurden zurueckgesetzt.");
    });

    readButton?.addEventListener("click", startReading);
    stopButton?.addEventListener("click", stopReading);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setPanelState(false);
    });

    document.addEventListener("click", (event) => {
      if (panel.hidden || panel.contains(event.target) || toggle.contains(event.target)) return;
      setPanelState(false);
    });
  }

  const teamProfiles = {
    "sv-horn": {
      kicker: "Gruppe A | U16 Oesterreich",
      country: "Oesterreich",
      summary: "Die U16 des SV Horn gehoert zur Nachwuchsarbeit des Vereins aus Niederoesterreich. Fuer das Pfingstturnier ist vor allem dieser Jahrgang relevant: Spieler im B-Junioren-Alter, die in Horn in einem leistungsorientierten Nachwuchsumfeld ausgebildet werden.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Nachwuchsraum", "Niederoesterreich"],
        ["Teambezug", "SV-Horn-Nachwuchs"],
      ],
      strengths: [
        "U16-Spieler aus einem oesterreichischen Nachwuchsverbund bringen einen anderen Spielrhythmus in die Gruppe.",
        "Der Jahrgang ist an regionale Nachwuchswettbewerbe und kompakte Turnierspiele gewoehnt.",
        "Fuer die TSV-Gegner ist Horn in der U16 ein internationaler Vergleich, kein Alltagsgegner.",
      ],
      sources: [
        ["SV Horn", "https://www.svhorn.at/"],
        ["Vereinsgeschichte", "https://www.svhorn.at/verein/geschichte"],
      ],
    },
    "kas-eupen": {
      kicker: "Gruppe A | U16 Belgien",
      country: "Belgien",
      summary: "Die KAS Eupen U16 ist Teil der Panda-Youngsters-Struktur. Auf dieser Altersstufe geht es um technische Ausbildung, Spieltempo und den naechsten Schritt aus dem Grundlagen- in den Leistungsbereich.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Nachwuchs", "Panda Youngsters"],
        ["Land", "Belgien"],
      ],
      strengths: [
        "Die U16 ist in eine klare Nachwuchsstruktur eingebunden, die technische Entwicklung betont.",
        "Belgische Nachwuchsteams suchen haeufig mutige Eins-gegen-eins-Loesungen und hohes Balltempo.",
        "Der Jahrgang bringt internationale Reize in eine Gruppe mit deutschen und oesterreichischen U16-Teams.",
      ],
      sources: [
        ["KAS Eupen", "https://www.as-eupen.be/"],
        ["Panda Youngsters", "https://www.as-eupen.be/panda-youngsters/"],
      ],
    },
    "eintracht-frankfurt": {
      kicker: "Gruppe A | U16 Deutschland",
      country: "Deutschland",
      summary: "Eintracht Frankfurt tritt mit der U16 aus dem Nachwuchsleistungszentrum an. Die Altersklasse ist bei der Eintracht der direkte Entwicklungsschritt im B-Junioren-Bereich und wird leistungsorientiert betreut.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Struktur", "Nachwuchsleistungszentrum"],
        ["Bereich", "B-Junioren-Nachwuchs"],
      ],
      strengths: [
        "Die U16 trainiert in einem NLZ-Umfeld mit hoher Trainingsdichte und professioneller Betreuung.",
        "Auf diesem Niveau sind schnelles Pressing und Anschlussaktionen nach Ballgewinn zentrale U16-Themen.",
        "Der Jahrgang ist regelmaessige Vergleiche mit starken Nachwuchsteams gewohnt.",
      ],
      sources: [
        ["Eintracht Nachwuchs", "https://nachwuchs.eintracht.de/"],
        ["NLZ", "https://nachwuchs.eintracht.de/leistungszentrum"],
      ],
    },
    "hannover-96": {
      kicker: "Gruppe A | U16 Deutschland",
      country: "Deutschland",
      summary: "Hannover 96 kommt mit einer U16 aus der 96 Akademie. Die Mannschaft gehoert zum B-Junioren-Bereich und wird innerhalb der Akademie als eigener Jahrgang betreut.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Struktur", "96 Akademie"],
        ["Bereich", "B-Junioren"],
      ],
      strengths: [
        "Die U16 ist in eine Akademiestruktur eingebunden, in der individuelle Entwicklung und Teamtaktik zusammenlaufen.",
        "Der Jahrgang bringt voraussichtlich viel Tempo und klare Rollen gegen den Ball mit.",
        "Fuer das Turnier ist Hannover ein echter U16-Vergleich aus einem etablierten Nachwuchsleistungsumfeld.",
      ],
      sources: [
        ["Hannover 96 Akademie", "https://www.hannover96.de/akademie/"],
        ["Die Akademie", "https://www.hannover96.de/akademie/die-akademie"],
      ],
    },
    "tsv-plattenhardt": {
      kicker: "Gruppe A | U16 Gastgeber",
      country: "Deutschland",
      summary: "Die U16 des TSV Plattenhardt ist beim Pfingstturnier der Gastgeberjahrgang. Fuer die Spieler bedeutet das: kurze Wege, vertrautes Gelaende und Spiele gegen Nachwuchsmannschaften aus mehreren Laendern.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Rolle", "Gastgeberteam"],
        ["Turnierort", "Sportgelaende Weilerhau"],
      ],
      strengths: [
        "Die U16 kennt das Gelaende, die Wege und die Atmosphaere am Weilerhau.",
        "Der Jahrgang hat die besondere Motivation, das eigene Pfingstturnier sportlich zu vertreten.",
        "Gegen Akademieteams kann der Gastgeber in jedem Spiel mutig und ohne lange Anreise auftreten.",
      ],
      sources: [
        ["TSV Plattenhardt", "https://www.tsvplattenhardt.de/"],
        ["Pfingstturnier", "https://www.tsvplattenhardt.de/kopie-pfingstturnier"],
      ],
    },
    "fc-basel": {
      kicker: "Gruppe B | U16 Schweiz",
      country: "Schweiz",
      summary: "Die U16 des FC Basel ist Teil der Ausbildung am FCB-Campus. In dieser Altersstufe stehen Technik, Spielintelligenz und der Schritt in hoehere Nachwuchsbereiche im Mittelpunkt.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Struktur", "FCB-Campus"],
        ["Land", "Schweiz"],
      ],
      strengths: [
        "Die U16 kommt aus einem Campus-Umfeld, in dem Ballkontrolle und Spielverstaendnis stark gewichtet werden.",
        "Der Jahrgang ist auf saubere Loesungen unter Druck und hohe Passqualitaet ausgelegt.",
        "Als Schweizer U16 bringt Basel ein anderes Ausbildungsprofil in die Gruppe B.",
      ],
      sources: [
        ["FC Basel", "https://www.fcb.ch/"],
        ["Campus", "https://fcb.ch/pages/campus"],
      ],
    },
    "viktoria-pilsen": {
      kicker: "Gruppe B | U16 Tschechien",
      country: "Tschechien",
      summary: "Die U16 von FC Viktoria Pilsen gehoert zur Jugendstruktur des tschechischen Klubs. Im Turnier ist dieser Jahrgang der Vergleich aus Tschechien und bringt eine andere Nachwuchsschule nach Plattenhardt.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Nachwuchs", "Jugend- und Akademieteams"],
        ["Land", "Tschechien"],
      ],
      strengths: [
        "Die U16 steht fuer einen physischen und wettkampfnahen Vergleich aus dem tschechischen Nachwuchsfussball.",
        "Der Jahrgang kann durch Direktheit, Koerperlichkeit und schnelles Nachruecken unangenehm werden.",
        "Gegen deutsche und schweizer U16-Teams entsteht ein echter internationaler Leistungsvergleich.",
      ],
      sources: [
        ["FC Viktoria Plzen", "https://www.fcviktoria.cz/eng/zobraz.asp?t=viktoria-v-kostce"],
        ["Youth football", "https://www.fcviktoria.cz/eng/zobraz.asp?t=vykonnostni-fotbal"],
      ],
    },
    "hessen-kassel": {
      kicker: "Gruppe B | U16 Deutschland",
      country: "Deutschland",
      summary: "Die U16 des KSV Hessen Kassel ist Teil des Nachwuchsbereichs der Loewen. Fuer das Pfingstturnier zaehlt der Jahrgang als regional gepraegtes U16-Team mit Leistungsanspruch.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Nachwuchs", "KSV-Hessen-Jugend"],
        ["Region", "Nordhessen"],
      ],
      strengths: [
        "Die U16 bringt eine regionale Nachwuchsausbildung mit viel Teamnaehe mit.",
        "Turnierspiele mit knappen Ergebnissen passen zu einem kompakten, robusten U16-Profil.",
        "Der Jahrgang kann ueber Zusammenhalt, Einsatz und klare Ablaeufe in der Gruppe punkten.",
      ],
      sources: [
        ["KSV Hessen", "https://www.ksvhessen.de/"],
        ["Nachwuchs", "https://www.ksvhessen.de/nachwuchs/nachwuchs/"],
      ],
    },
    "kaiserslautern": {
      kicker: "Gruppe B | U16 Deutschland",
      country: "Deutschland",
      summary: "Die U16 des 1. FC Kaiserslautern kommt aus dem Nachwuchsleistungszentrum am Froehnerhof. In dieser Altersklasse geht es um den Uebergang in den leistungsorientierten B-Junioren-Bereich.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Struktur", "Nachwuchsleistungszentrum"],
        ["Trainingsbasis", "Froehnerhof"],
      ],
      strengths: [
        "Die U16 ist an ein NLZ-Umfeld mit klarer Leistungssteuerung und intensiver Trainingsarbeit angebunden.",
        "Der Jahrgang bringt Mentalitaet, Athletik und Spielintelligenz aus dem B-Junioren-Aufbau mit.",
        "Im Turnier ist Kaiserslautern ein starker U16-Massstab aus einem grossen Nachwuchszentrum.",
      ],
      sources: [
        ["FCK", "https://fck.de/"],
        ["Leistungszentrum", "https://fck.de/fussball/nachwuchsleistungszentrum/"],
      ],
    },
    "ssv-reutlingen": {
      kicker: "Gruppe B | U16 Deutschland",
      country: "Deutschland",
      summary: "Die U16 des SSV Reutlingen 05 kommt aus dem Nachwuchsbereich des wuerttembergischen Vereins. Beim Pfingstturnier trifft dieser Jahrgang auf Akademie- und Ausbildungsteams aus mehreren Laendern.",
      facts: [
        ["Altersklasse", "U16 / Jahrgang 2010"],
        ["Nachwuchs", "SSV-Akademie-Umfeld"],
        ["Region", "Wuerttemberg"],
      ],
      strengths: [
        "Die U16 kann ueber Einsatz, Tempo und regionale Identitaet ins Turnier kommen.",
        "Gegen grosse Nachwuchsadressen ist der Jahrgang ein spannender Leistungsvergleich aus Wuerttemberg.",
        "Kurze Wege im Vereinsumfeld helfen, als Team geschlossen aufzutreten.",
      ],
      sources: [
        ["SSV Reutlingen", "https://www.ssv-reutlingen-fussball.de/"],
        ["SSV Akademie", "https://www.ssv-reutlingen-fussball.de/ssv-akademie/fussballschule/"],
      ],
    },
  };

  function setupTeamDialog() {
    const dialog = document.querySelector("[data-team-dialog]");
    if (!dialog) return;

    const fields = {
      close: dialog.querySelector("[data-team-close]"),
      logo: dialog.querySelector("[data-team-logo]"),
      country: dialog.querySelector("[data-team-country]"),
      kicker: dialog.querySelector("[data-team-kicker]"),
      name: dialog.querySelector("[data-team-name]"),
      summary: dialog.querySelector("[data-team-summary]"),
      facts: dialog.querySelector("[data-team-facts]"),
      strengths: dialog.querySelector("[data-team-strengths]"),
      sources: dialog.querySelector("[data-team-sources]"),
    };

    function clearNode(node) {
      while (node?.firstChild) node.removeChild(node.firstChild);
    }

    function fillList(node, items, renderItem) {
      clearNode(node);
      items.forEach((item) => node.appendChild(renderItem(item)));
    }

    function openTeam(card) {
      const profile = teamProfiles[card.dataset.teamInfo];
      if (!profile) return;

      const logo = card.querySelector("img");
      fields.logo.src = logo?.getAttribute("src") || "";
      fields.logo.alt = logo?.getAttribute("alt") || "";
      fields.country.textContent = profile.country;
      fields.kicker.textContent = profile.kicker;
      fields.name.textContent = card.querySelector("h4")?.textContent || "";
      fields.summary.textContent = profile.summary;

      fillList(fields.facts, profile.facts, ([label, value]) => {
        const item = document.createElement("article");
        const labelNode = document.createElement("span");
        const valueNode = document.createElement("b");
        labelNode.textContent = label;
        valueNode.textContent = value;
        item.append(labelNode, valueNode);
        return item;
      });

      fillList(fields.strengths, profile.strengths, (text) => {
        const item = document.createElement("li");
        item.textContent = text;
        return item;
      });

      fillList(fields.sources, profile.sources, ([label, url]) => {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = label;
        return link;
      });

      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    }

    function closeDialog() {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }

    document.querySelectorAll("[data-team-info]").forEach((card) => {
      card.addEventListener("click", () => openTeam(card));
      card.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openTeam(card);
      });
    });

    fields.close?.addEventListener("click", closeDialog);
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activatePanel(tab));
  });

  setupMobileMenu();
  setupScrollTop();
  setupAccessibilityTools();
  setupTeamDialog();
  protectVisualAssets();
  updateCountdown();
  setInterval(updateCountdown, 1000);
})();
