(function (root) {
  "use strict";

  function validateRoundCount(roundCount) {
    if (!Number.isInteger(roundCount) || roundCount < 1 || roundCount > 1000) {
      throw new RangeError("Количество раундов должно быть целым числом от 1 до 1000.");
    }
  }

  function createController(options) {
    var config = options || {};
    var game = config.gameLogic || root.GameLogic;
    var randomSource = config.randomSource;
    var schedule = config.schedule || function (callback) {
      return setTimeout(callback, 0);
    };
    var cancelSchedule = config.cancelSchedule || function (handle) {
      clearTimeout(handle);
    };
    var state = makeInitialState();
    var handlers = {};
    var scheduledHandle = null;

    if (!game || typeof game.createPermutation !== "function" ||
        typeof game.runRandomStrategy !== "function" ||
        typeof game.runChainStrategy !== "function") {
      throw new TypeError("Для турнира требуется доступное игровое ядро GameLogic.");
    }

    function makeInitialState() {
      return {
        status: "idle",
        selectedRounds: 0,
        completedRounds: 0,
        rounds: [],
        randomWins: 0,
        chainWins: 0,
        randomRate: null,
        chainRate: null,
        errorMessage: ""
      };
    }

    function snapshot() {
      return {
        status: state.status,
        selectedRounds: state.selectedRounds,
        completedRounds: state.completedRounds,
        rounds: state.rounds.slice(),
        randomWins: state.randomWins,
        chainWins: state.chainWins,
        randomRate: state.randomRate,
        chainRate: state.chainRate,
        errorMessage: state.errorMessage
      };
    }

    function notifyUpdate() {
      if (typeof handlers.onUpdate === "function") {
        handlers.onUpdate(snapshot());
      }
    }

    function finish(status, error) {
      state.status = status;
      state.errorMessage = error ? error.message : "";
      scheduledHandle = null;
      notifyUpdate();
    }

    function scheduleNextRound() {
      if (state.status !== "running") {
        return;
      }
      scheduledHandle = schedule(runNextRound);
    }

    function runNextRound() {
      scheduledHandle = null;
      if (state.status !== "running") {
        return;
      }

      try {
        var permutation = game.createPermutation(randomSource);
        var randomResult = game.runRandomStrategy(permutation, randomSource);
        var chainResult = game.runChainStrategy(permutation);
        var round = {
          roundNumber: state.completedRounds + 1,
          randomResult: {
            won: randomResult.won === true,
            successfulPrisoners: randomResult.successfulPrisoners
          },
          chainResult: {
            won: chainResult.won === true,
            successfulPrisoners: chainResult.successfulPrisoners
          }
        };

        state.rounds.push(round);
        state.completedRounds += 1;
        if (randomResult.won === true) {
          state.randomWins += 1;
        }
        if (chainResult.won === true) {
          state.chainWins += 1;
        }

        state.randomRate = state.randomWins / state.completedRounds * 100;
        state.chainRate = state.chainWins / state.completedRounds * 100;

        if (state.completedRounds === state.selectedRounds) {
          state.status = "completed";
        }
        notifyUpdate();

        if (state.status === "running") {
          scheduleNextRound();
        }
      } catch (error) {
        finish("error", error);
      }
    }

    return {
      start: function (roundCount, callbacks) {
        validateRoundCount(roundCount);
        if (state.status === "running") {
          throw new Error("Турнир уже выполняется.");
        }

        state = makeInitialState();
        state.status = "running";
        state.selectedRounds = roundCount;
        handlers = callbacks || {};
        notifyUpdate();
        scheduleNextRound();
        return snapshot();
      },

      abort: function () {
        if (state.status !== "running") {
          return false;
        }

        if (scheduledHandle !== null) {
          cancelSchedule(scheduledHandle);
          scheduledHandle = null;
        }
        finish("aborted");
        return true;
      },

      reset: function () {
        if (state.status === "running") {
          throw new Error("Нельзя сбросить выполняющийся турнир без прерывания.");
        }
        state = makeInitialState();
        handlers = {};
        notifyUpdate();
        return snapshot();
      },

      getState: snapshot
    };
  }

  var api = {
    createController: createController,
    validateRoundCount: validateRoundCount
  };

  root.Tournament = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
}(typeof window !== "undefined" ? window : globalThis));
