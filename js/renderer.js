(function (root) {
  "use strict";

  var renderedRoundCount = 0;
  var elements = {
    roundCount: document.getElementById("round-count"),
    startButton: document.getElementById("tournament-start"),
    abortButton: document.getElementById("tournament-abort"),
    newButton: document.getElementById("tournament-new"),
    setupStatus: document.getElementById("setup-status"),
    progress: document.getElementById("tournament-progress"),
    completedRounds: document.getElementById("completed-rounds"),
    randomWins: document.getElementById("random-wins"),
    chainWins: document.getElementById("chain-wins"),
    randomRate: document.getElementById("random-rate"),
    chainRate: document.getElementById("chain-rate"),
    roundResults: document.getElementById("round-results")
  };

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  function formatRate(rate) {
    return rate === null ? "—" : rate.toFixed(1) + "%";
  }

  function createCell(text, className) {
    var cell = document.createElement("td");
    cell.textContent = text;
    if (className) {
      cell.className = className;
    }
    return cell;
  }

  function createResultCell(result) {
    var successCount = typeof result.successfulPrisoners === "number"
      ? result.successfulPrisoners
      : (result.won ? 100 : 0);
    var outcome = result.won ? "Победа" : "Поражение";
    var cell = createCell(outcome + " · " + successCount + "/100", result.won ? "result-cell result-win" : "result-cell result-loss");
    cell.setAttribute("aria-label", outcome + ", " + successCount + " из 100 заключённых нашли свои номера");
    return cell;
  }

  function clearRows() {
    while (elements.roundResults.firstChild) {
      elements.roundResults.removeChild(elements.roundResults.firstChild);
    }
    renderedRoundCount = 0;
  }

  function renderRows(rounds) {
    if (!elements.roundResults) {
      return;
    }

    if (rounds.length === 0) {
      clearRows();
      var emptyRow = document.createElement("tr");
      emptyRow.className = "empty-row";
      var emptyCell = createCell("Турнир ещё не запущен");
      emptyCell.colSpan = 3;
      emptyRow.appendChild(emptyCell);
      elements.roundResults.appendChild(emptyRow);
      return;
    }

    if (rounds.length < renderedRoundCount) {
      clearRows();
    } else if (renderedRoundCount === 0 && elements.roundResults.firstChild) {
      clearRows();
    }

    for (var index = renderedRoundCount; index < rounds.length; index += 1) {
      var round = rounds[index];
      var row = document.createElement("tr");
      row.appendChild(createCell(String(round.roundNumber), "round-number"));
      row.appendChild(createResultCell(round.randomResult));
      row.appendChild(createResultCell(round.chainResult));
      elements.roundResults.appendChild(row);
    }
    renderedRoundCount = rounds.length;
  }

  function getStatusText(state) {
    if (state.status === "running") {
      if (state.completedRounds === 0) {
        return "Выполняется раунд 1 из " + state.selectedRounds + ".";
      }
      return "Завершено раундов: " + state.completedRounds + " из " + state.selectedRounds + ".";
    }
    if (state.status === "completed") {
      return "Турнир завершён: " + state.completedRounds + " из " + state.selectedRounds + " раундов.";
    }
    if (state.status === "aborted") {
      return "Турнир прерван после " + state.completedRounds + " завершённых раундов.";
    }
    if (state.status === "error") {
      return "Не удалось выполнить турнир: " + state.errorMessage;
    }
    return "Турнир ещё не запущен. Выберите число раундов.";
  }

  function renderTournament(state) {
    var isRunning = state.status === "running";
    var canStart = state.status === "idle";

    setText(elements.setupStatus, getStatusText(state));
    setText(elements.progress, state.status === "idle"
      ? "Ожидает запуска"
      : "Завершено раундов: " + state.completedRounds + " из " + state.selectedRounds);
    setText(elements.completedRounds, String(state.completedRounds));
    setText(elements.randomWins, String(state.randomWins));
    setText(elements.chainWins, String(state.chainWins));
    setText(elements.randomRate, "Частота: " + formatRate(state.randomRate));
    setText(elements.chainRate, "Частота: " + formatRate(state.chainRate));

    if (elements.roundCount) {
      elements.roundCount.disabled = isRunning;
    }
    if (elements.startButton) {
      elements.startButton.hidden = !canStart;
    }
    if (elements.abortButton) {
      elements.abortButton.hidden = !isRunning;
    }
    if (elements.newButton) {
      elements.newButton.hidden = state.status === "idle" || isRunning;
    }

    renderRows(state.rounds);
  }

  root.TournamentRenderer = {
    render: renderTournament,
    showError: function (message) {
      setText(elements.setupStatus, message);
    }
  };

  if (typeof module === "object" && module.exports) {
    module.exports = root.TournamentRenderer;
  }
}(typeof window !== "undefined" ? window : globalThis));
