(() => {
  // Countdown zum ersten Turniertag. Die Werte bleiben bewusst im Markup,
  // damit die Turnierleitung das Datum spaeter leicht anpassen kann.
  const countdown = document.querySelector("[data-countdown]");
  const time = {
    day: 1000 * 60 * 60 * 24,
    hour: 1000 * 60 * 60,
    minute: 1000 * 60,
  };

  function writeCountdownValue(selector, value) {
    const node = countdown?.querySelector(selector);
    if (node) node.textContent = value;
  }

  function updateCountdown() {
    if (!countdown) return;

    const target = new Date(countdown.dataset.countdown).getTime();
    const distance = Math.max(0, target - Date.now());

    writeCountdownValue("[data-days]", Math.floor(distance / time.day));
    writeCountdownValue("[data-hours]", Math.floor((distance % time.day) / time.hour));
    writeCountdownValue("[data-minutes]", Math.floor((distance % time.hour) / time.minute));
    writeCountdownValue("[data-seconds]", Math.floor((distance % time.minute) / 1000));
  }

  function activatePanel(tab) {
    const targetPanel = document.getElementById(tab.dataset.day);
    if (!targetPanel) return;

    document.querySelectorAll(".tab").forEach((button) => button.classList.remove("active"));
    document.querySelectorAll(".fixtures").forEach((panel) => panel.classList.remove("active"));

    tab.classList.add("active");
    targetPanel.classList.add("active");
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

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => activatePanel(tab));
  });

  setupMobileMenu();
  setupScrollTop();
  protectVisualAssets();
  updateCountdown();
  setInterval(updateCountdown, 1000);
})();
