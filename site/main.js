const copy = {
  en: {
    brand: "CubeControl",
    "nav.features": "Features",
    "nav.safety": "Safety",
    "nav.download": "Download",
    "hero.title": "Open control for the CUBE Baby.",
    "hero.lede":
      "Unofficial desktop editor with real setlists, live A/B/C editing, and Cab 8 IR tools — built on an open MIDI core.",
    "cta.download": "Download for Windows",
    "cta.github": "View on GitHub",
    "feat.library.title": "Shows that survive the gig",
    "feat.library.copy":
      "Build presets, songs, and ordered setlists in the library — then take them to Stage without digging through bank slots.",
    "feat.device.title": "IR distance & Cab 8",
    "feat.device.copy":
      "Device tools for bank export/import and MIC DIST on Cabinet 8 — the safer slot for custom IRs.",
    "safety.title": "Experimental. Prefer Cab 8.",
    "safety.copy":
      "CubeControl is not affiliated with M-VAVE or Cuvave. USB writes can brick factory IRs outside Cab 8 — export your bank first, and treat every write as experimental.",
    "safety.link": "Read SAFETY.md",
    "oss.title": "Open where it matters",
    "oss.copy":
      "App and hardware protocol are MIT. Report bugs from the app or open an issue — we want real USB capture notes.",
    "foot.mark": "CubeControl · unofficial CUBE Baby editor",
    "foot.meta": "v0.1.0 · Windows NSIS + portable",
  },
  es: {
    brand: "CubeControl",
    "nav.features": "Funciones",
    "nav.safety": "Seguridad",
    "nav.download": "Descargar",
    "hero.title": "Control abierto para el CUBE Baby.",
    "hero.lede":
      "Editor de escritorio no oficial con setlists reales, edición A/B/C en vivo y herramientas IR en Cab 8 — sobre un núcleo MIDI abierto.",
    "cta.download": "Descargar para Windows",
    "cta.github": "Ver en GitHub",
    "feat.library.title": "Shows que aguantan el bolo",
    "feat.library.copy":
      "Arma presets, canciones y setlists ordenados en la biblioteca — y llévalos a Stage sin pelearte con el bank.",
    "feat.device.title": "Distancia IR y Cab 8",
    "feat.device.copy":
      "Herramientas Device para exportar/importar bank y MIC DIST en Cabinet 8 — el slot más seguro para IRs custom.",
    "safety.title": "Experimental. Prefiere Cab 8.",
    "safety.copy":
      "CubeControl no está afiliado a M-VAVE ni Cuvave. Las escrituras USB pueden dañar IRs de fábrica fuera de Cab 8 — exporta el bank primero y trata cada write como experimental.",
    "safety.link": "Leer SAFETY.md",
    "oss.title": "Abierto donde importa",
    "oss.copy":
      "App y protocolo de hardware son MIT. Reporta bugs desde la app o abre un issue — queremos notas reales de capturas USB.",
    "foot.mark": "CubeControl · editor no oficial del CUBE Baby",
    "foot.meta": "v0.1.0 · Windows NSIS + portable",
  },
};

const stored = localStorage.getItem("cubecontrol.site.lang");
const initial =
  stored === "es" || stored === "en"
    ? stored
    : navigator.language.toLowerCase().startsWith("es")
      ? "es"
      : "en";

function applyLang(lang) {
  const dict = copy[lang] ?? copy.en;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (key && dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.classList.toggle("is-active", btn.getAttribute("data-lang") === lang);
  });
  localStorage.setItem("cubecontrol.site.lang", lang);
}

applyLang(initial);

document.querySelectorAll(".lang-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const lang = btn.getAttribute("data-lang");
    if (lang === "en" || lang === "es") applyLang(lang);
  });
});

const frame = document.querySelector(".hero__frame");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (frame && !reduce) {
  const onMove = (event) => {
    const rect = frame.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    frame.style.transform = `perspective(1200px) rotateY(${x * 4}deg) rotateX(${-y * 3}deg) translateY(${y * -6}px)`;
  };
  const onLeave = () => {
    frame.style.transform = "";
  };
  frame.addEventListener("pointermove", onMove);
  frame.addEventListener("pointerleave", onLeave);
}
