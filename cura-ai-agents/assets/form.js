/* Contact form delivery, shared by both sites.
 *
 * These are Framer static exports. Their forms carry no `action`: on the real
 * Framer-hosted site the submission is handled by Framer's own backend, which
 * does not exist here, so left alone the form silently does nothing.
 *
 * This takes the submit over before Framer's own handler sees it (capture
 * phase), posts the fields as JSON to the shared PHP handler, and shows the
 * result in place of the button.
 *
 * The endpoint is same-origin and relative, so the same file works whatever
 * path the site is served from - /servio-ai-agents/, /cura-ai-agents/, or a
 * bare IP during testing - and there is no credential in the page.
 *
 * Which site this is comes from the `data-site` attribute on the script tag:
 *   <script src="assets/form.js" data-site="servio" defer></script>
 * The handler checks that against its own allowlist.
 */
(function () {
  "use strict";

  /* document.currentScript is only set while the script is first evaluating.
     Everything below runs later - after hydration, and again on every retry -
     by which time it reads null, so the tag is looked up by src instead and
     the values are read once, up front. */
  var script = document.currentScript ||
               document.querySelector('script[src*="form.js"][data-site]');
  var SITE = (script && script.getAttribute("data-site")) || "";
  var ENDPOINT = (script && script.getAttribute("data-endpoint")) || "../api/contact.php";

  /* The Framer export ships eleven decoy fields that no human sees. They are
     left in the DOM for bots to fill, but stripped before sending so a real
     submission is never mistaken for one. */
  var HONEYPOTS = ["website", "company", "message", "subject", "title",
                   "description", "feedback", "notes", "details", "remarks",
                   "comments"];

  /* Both pages carry several forms - the real one plus newsletter boxes that
     share the same markup. Picking "the first form" is fragile, so the one
     with the most real (non-decoy) fields wins. */
  function findForm() {
    var best = null, bestCount = 0;
    var forms = document.querySelectorAll("form");
    for (var i = 0; i < forms.length; i++) {
      var fields = forms[i].querySelectorAll("input, textarea, select");
      var real = 0;
      for (var j = 0; j < fields.length; j++) {
        if (fields[j].getAttribute("tabindex") !== "-1" &&
            fields[j].type !== "hidden" && fields[j].type !== "submit") real++;
      }
      if (real > bestCount) { bestCount = real; best = forms[i]; }
    }
    return bestCount >= 2 ? best : null;
  }

  /* form.reset() alone is not enough here. These are React-controlled inputs:
     Framer holds the typed value in its own state and writes it straight back
     to the DOM, so a native reset clears the box for one frame and the text
     reappears. Setting the value through the prototype setter and firing the
     input event is what React itself listens for, so its state clears too. */
  function clearForm(form) {
    var fields = form.querySelectorAll("input, textarea, select");
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.type === "hidden" || el.type === "submit" || el.type === "button") continue;

      var proto = el instanceof window.HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : el instanceof window.HTMLSelectElement
          ? window.HTMLSelectElement.prototype
          : window.HTMLInputElement.prototype;

      var setter = Object.getOwnPropertyDescriptor(proto, "value");
      if (setter && setter.set) {
        setter.set.call(el, "");
      } else {
        el.value = "";
      }
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  function setMessage(form, text, ok) {
    var el = form.querySelector(".form-msg");
    if (!el) {
      el = document.createElement("p");
      el.className = "form-msg";
      form.appendChild(el);
    }
    el.textContent = text;
    el.setAttribute("role", "status");
    el.style.cssText =
      "margin:12px 0 0;font-family:inherit;font-size:14px;line-height:1.4;" +
      "text-align:center;color:" + (ok ? "rgb(24,128,56)" : "rgb(178,39,27)");
  }

  function submit(form, button) {
    var data = new FormData(form);
    var payload = { site: SITE };

    data.forEach(function (v, k) {
      if (HONEYPOTS.indexOf(k) !== -1) return;   // exact name: a decoy
      if (typeof v !== "string") return;         // skip file inputs
      if (v.trim() !== "") payload[k] = v;
    });

    setMessage(form, "Sending…", true);
    if (button) button.disabled = true;

    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; });
      })
      .then(function (res) {
        if (res && res.success) {
          clearForm(form);
          setMessage(form, res.message || "Thank you - we will be in touch shortly.", true);
        } else {
          setMessage(form, (res && res.message) ||
            "Something went wrong. Please try again.", false);
        }
      })
      .catch(function () {
        setMessage(form, "Could not reach the server. Please try again.", false);
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  }

  function attach() {
    var form = findForm();
    if (!form || form.dataset.formBound) return !!form;
    form.dataset.formBound = "1";

    /* The template renders the button in a "Disabled" variant that never
       enables without Framer's own form state, so it is re-enabled here. */
    var button = form.querySelector('button[type="submit"], button');
    if (button) {
      button.disabled = false;
      button.style.opacity = "1";
      button.style.cursor = "pointer";
    }

    /* Guards the two paths below against both firing for one click. */
    var busy = false;
    function go() {
      if (busy) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      busy = true;
      submit(form, button).then(function () { busy = false; });
    }

    // capture phase, so this runs before Framer's own React handler
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopPropagation();
      go();
    }, true);

    /* Cura's button carries no type="submit". A bare <button> in a form should
       still submit, but Framer's own click handler calls preventDefault first,
       so the form never dispatches submit at all and the listener above never
       runs - the button simply did nothing. Catching the click in capture
       phase gets in ahead of that. Servio's button does have type="submit",
       so there the submit listener wins and `busy` stops the double post. */
    if (button) {
      button.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        go();
      }, true);
    }

    return true;
  }

  function start() {
    if (!SITE) {
      console.error("form.js: no data-site on the script tag; submissions will be rejected");
    }

    /* Binding once is not enough. The server-rendered HTML carries four forms;
       React then hydrates and throws those nodes away, leaving two fresh ones.
       A listener attached before that happens goes with the discarded node, so
       the button ends up wired to nothing and a click does nothing at all -
       silently, because no error is raised.
     *
     * So the page is watched instead of polled: every time the DOM settles the
     * current form is re-checked, and any form not carrying our marker is
     * bound again. The marker lives on the element, so a replaced node has no
     * marker and is picked up, while an untouched one is skipped. */
    attach();

    var pending = false;
    var observer = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        attach();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // hydration is normally done well inside this; the observer is only a net
    setTimeout(function () { attach(); }, 1500);
    setTimeout(function () { attach(); }, 4000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
