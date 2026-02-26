(function (window, document) {
  "use strict";

  function setHighlightEnabled(enabled) {
    var targets = document.querySelectorAll("[data-highlight-target]");
    targets.forEach(function (target) {
      if (enabled) {
        target.classList.add("is-highlighted");
      } else {
        target.classList.remove("is-highlighted");
      }
    });
  }

  window.LAB_HIGHLIGHT = {
    enabled: false,
    toggle: function () {
      this.enabled = !this.enabled;
      setHighlightEnabled(this.enabled);
      return this.enabled;
    },
    set: function (enabled) {
      this.enabled = Boolean(enabled);
      setHighlightEnabled(this.enabled);
      return this.enabled;
    }
  };
})(window, document);
