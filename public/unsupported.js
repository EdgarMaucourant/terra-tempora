// Shown instead of the globe when this browser can't run it: WebGL turned off
// or blocked, or a browser too old for the site's code. (Without JavaScript,
// the <noscript> block of index.html says the same.)
// This is a plain script, loaded before the app and written in old-style
// JavaScript on purpose, so that an old browser can still run it. The app's
// interface text (src/locales) can't be used here, as it comes with the app.
(function () {
  var TEXT = {
    en: {
      title: "Terra Tempora can't show the globe in this browser",
      webgl:
        "The globe and the map need WebGL, which lets the browser draw 3D graphics, and it is turned off or blocked here.",
      webglHelp:
        "Turn on WebGL or hardware acceleration in your browser's settings, or try another browser, then reload the page.",
      old: "This browser is too old for the site's code.",
      oldHelp: "Update your browser, or try another one, then reload the page.",
      needs:
        "Terra Tempora needs JavaScript, WebGL and a browser from 2023 or later.",
      reload: "Reload",
      check: "Check WebGL in this browser",
    },
    fr: {
      title: "Terra Tempora ne peut pas afficher le globe dans ce navigateur",
      webgl:
        "Le globe et la carte ont besoin de WebGL, qui permet au navigateur de dessiner en 3D, et il est désactivé ou bloqué ici.",
      webglHelp:
        "Activez WebGL ou l'accélération matérielle dans les réglages du navigateur, ou essayez-en un autre, puis rechargez la page.",
      old: "Ce navigateur est trop ancien pour le code du site.",
      oldHelp:
        "Mettez votre navigateur à jour, ou essayez-en un autre, puis rechargez la page.",
      needs:
        "Terra Tempora a besoin de JavaScript, de WebGL et d'un navigateur de 2023 ou plus récent.",
      reload: "Recharger",
      check: "Tester WebGL dans ce navigateur",
    },
    es: {
      title: "Terra Tempora no puede mostrar el globo en este navegador",
      webgl:
        "El globo y el mapa necesitan WebGL, que permite al navegador dibujar en 3D, y está desactivado o bloqueado aquí.",
      webglHelp:
        "Activa WebGL o la aceleración por hardware en los ajustes del navegador, o prueba otro, y luego recarga la página.",
      old: "Este navegador es demasiado antiguo para el código del sitio.",
      oldHelp:
        "Actualiza tu navegador, o prueba otro, y luego recarga la página.",
      needs:
        "Terra Tempora necesita JavaScript, WebGL y un navegador de 2023 o más reciente.",
      reload: "Recargar",
      check: "Probar WebGL en este navegador",
    },
  };

  // The same choice as the app: ?lang=, the reader's earlier choice, the browser.
  function language() {
    var asked = (/[?&]lang=([a-z]+)/.exec(location.search) || [])[1];
    var chosen = null;
    try {
      chosen = localStorage.getItem("terra-tempora:language");
    } catch (e) {}
    var wanted = [asked, chosen].concat(
      navigator.languages || [navigator.language]
    );
    for (var i = 0; i < wanted.length; i++) {
      var code = wanted[i] && String(wanted[i]).slice(0, 2).toLowerCase();
      if (TEXT[code]) return code;
    }
    return "en";
  }

  var shown = false;
  function show(reason) {
    if (shown || !document.body) return;
    shown = true;
    var code = language();
    var text = TEXT[code];
    var app = document.getElementById("app");
    if (app) app.style.display = "none";
    var box = document.createElement("section");
    box.className = "unsupported";
    box.setAttribute("role", "alert");
    box.setAttribute("lang", code);
    box.setAttribute(
      "style",
      "position:fixed;top:0;right:0;bottom:0;left:0;z-index:1000;overflow:auto;padding:2rem 1rem;background:#07090d;color:#f3f1ec;font:1rem/1.5 system-ui,sans-serif"
    );
    var inner = document.createElement("div");
    inner.setAttribute("style", "max-width:36rem;margin:10vh auto 0");
    function add(tag, content, style) {
      var node = document.createElement(tag);
      node.textContent = content;
      if (style) node.setAttribute("style", style);
      inner.appendChild(node);
      return node;
    }
    add("h1", text.title, "font-size:1.5rem;line-height:1.25;margin:0 0 1rem");
    add("p", reason === "webgl" ? text.webgl : text.old);
    add("p", reason === "webgl" ? text.webglHelp : text.oldHelp);
    add("p", text.needs, "color:#b9b4a8");
    var actions = document.createElement("p");
    actions.setAttribute("style", "margin-top:1.5rem");
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = text.reload;
    button.setAttribute(
      "style",
      "font:inherit;padding:.5rem 1.25rem;border-radius:999px;border:1px solid #f3f1ec;background:#f3f1ec;color:#07090d;cursor:pointer;margin-right:1rem"
    );
    button.onclick = function () {
      location.reload();
    };
    actions.appendChild(button);
    if (reason === "webgl") {
      var link = document.createElement("a");
      link.href = "https://get.webgl.org/";
      link.rel = "noopener";
      link.textContent = text.check;
      link.setAttribute("style", "color:#f3f1ec");
      actions.appendChild(link);
    }
    inner.appendChild(actions);
    box.appendChild(inner);
    document.body.appendChild(box);
  }
  // The app calls this too, when the globe can't start after all.
  window.terraTemporaUnsupported = show;

  function hasWebGL() {
    try {
      var canvas = document.createElement("canvas");
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext("webgl2") || canvas.getContext("webgl"))
      );
    } catch (e) {
      return false;
    }
  }
  // A few things of the browsers the site's code is built for.
  function recentEnough() {
    return (
      typeof Array.prototype.at === "function" &&
      typeof Object.hasOwn === "function" &&
      typeof structuredClone === "function" &&
      "noModule" in document.createElement("script")
    );
  }

  var problem = !recentEnough() ? "old" : !hasWebGL() ? "webgl" : null;
  if (problem) {
    document.documentElement.setAttribute("data-unsupported", problem);
    if (document.body) show(problem);
    else
      document.addEventListener("DOMContentLoaded", function () {
        show(problem);
      });
  }

  // The app's code failing to load as a whole (a syntax this browser doesn't
  // know) is a browser too old as well.
  window.addEventListener("error", function (event) {
    if (document.documentElement.hasAttribute("data-started")) return;
    if (
      event.error instanceof SyntaxError ||
      /SyntaxError/.test(String(event.message))
    )
      show("old");
  });
})();
