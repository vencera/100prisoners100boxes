(function (root) {
  "use strict";

  var tournament = root.Tournament;
  var renderer = root.TournamentRenderer;
  var form = document.getElementById("tournament-form");
  var roundCount = document.getElementById("round-count");
  var abortButton = document.getElementById("tournament-abort");
  var newButton = document.getElementById("tournament-new");

  if (!tournament || !renderer || !form || !roundCount || !abortButton || !newButton) {
    return;
  }

  var controller = tournament.createController();
  renderer.render(controller.getState());

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    try {
      controller.start(Number(roundCount.value), {
        onUpdate: renderer.render
      });
    } catch (error) {
      renderer.showError(error.message);
    }
  });

  abortButton.addEventListener("click", function () {
    controller.abort();
  });

  newButton.addEventListener("click", function () {
    renderer.render(controller.reset());
  });
}(typeof window !== "undefined" ? window : globalThis));
