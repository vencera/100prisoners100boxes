(function (root) {
  "use strict";

  var PRISONER_COUNT = 100;
  var BOX_COUNT = 100;
  var OPEN_LIMIT = 50;

  function validatePermutation(permutation) {
    if (!Array.isArray(permutation) || permutation.length !== BOX_COUNT) {
      throw new TypeError("Раскладка должна быть массивом из 100 номеров.");
    }

    var seen = new Uint8Array(BOX_COUNT + 1);

    for (var i = 0; i < permutation.length; i += 1) {
      var value = permutation[i];

      if (!Number.isInteger(value) || value < 1 || value > BOX_COUNT) {
        throw new RangeError("Каждая карточка должна иметь целый номер от 1 до 100.");
      }

      if (seen[value]) {
        throw new RangeError("Раскладка не должна содержать повторяющиеся номера.");
      }

      seen[value] = 1;
    }

    return true;
  }

  function isValidPermutation(permutation) {
    try {
      validatePermutation(permutation);
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveRandomSource(randomSource) {
    var source = randomSource === undefined ? Math.random : randomSource;

    if (typeof source !== "function") {
      throw new TypeError("Генератор случайных чисел должен быть функцией.");
    }

    return source;
  }

  function drawRandom(randomSource) {
    var value = randomSource();

    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError("Генератор должен возвращать число в диапазоне [0, 1).");
    }

    return value;
  }

  function createPermutation(randomSource) {
    var random = resolveRandomSource(randomSource);
    var permutation = [];

    for (var i = 1; i <= BOX_COUNT; i += 1) {
      permutation.push(i);
    }

    for (var index = permutation.length - 1; index > 0; index -= 1) {
      var swapIndex = Math.floor(drawRandom(random) * (index + 1));
      var value = permutation[index];
      permutation[index] = permutation[swapIndex];
      permutation[swapIndex] = value;
    }

    return permutation;
  }

  function analyzeCycles(permutation) {
    validatePermutation(permutation);

    var visited = new Uint8Array(BOX_COUNT);
    var cycleLengths = [];
    var maxCycleLength = 0;

    for (var start = 0; start < BOX_COUNT; start += 1) {
      if (visited[start]) {
        continue;
      }

      var current = start;
      var length = 0;

      while (!visited[current]) {
        visited[current] = 1;
        length += 1;
        current = permutation[current] - 1;
      }

      cycleLengths.push(length);
      if (length > maxCycleLength) {
        maxCycleLength = length;
      }
    }

    return {
      cycleLengths: cycleLengths,
      maxCycleLength: maxCycleLength
    };
  }

  function makePrisonerResult(prisonerNumber, openedBoxes, openedNumbers) {
    var success = openedNumbers.indexOf(prisonerNumber) !== -1;

    return {
      prisonerNumber: prisonerNumber,
      openedBoxes: openedBoxes,
      openedNumbers: openedNumbers,
      foundNumber: success ? prisonerNumber : null,
      openCount: openedBoxes.length,
      success: success
    };
  }

  function makeStrategyResult(strategy, prisoners, diagnostics) {
    var successfulPrisoners = 0;
    var totalOpens = 0;

    for (var i = 0; i < prisoners.length; i += 1) {
      if (prisoners[i].success) {
        successfulPrisoners += 1;
      }
      totalOpens += prisoners[i].openCount;
    }

    var result = {
      strategy: strategy,
      won: successfulPrisoners === PRISONER_COUNT,
      successfulPrisoners: successfulPrisoners,
      totalPrisoners: PRISONER_COUNT,
      totalOpens: totalOpens,
      prisoners: prisoners
    };

    if (diagnostics) {
      result.cycleLengths = diagnostics.cycleLengths.slice();
      result.maxCycleLength = diagnostics.maxCycleLength;
    }

    return result;
  }

  function runRandomStrategy(permutation, randomSource) {
    validatePermutation(permutation);
    var random = resolveRandomSource(randomSource);
    var prisoners = [];

    for (var prisonerNumber = 1; prisonerNumber <= PRISONER_COUNT; prisonerNumber += 1) {
      var unopenedBoxes = [];
      for (var boxNumber = 1; boxNumber <= BOX_COUNT; boxNumber += 1) {
        unopenedBoxes.push(boxNumber);
      }

      // Частичное перемешивание выбирает равномерную случайную последовательность коробок без повторений.
      for (var selectionIndex = 0; selectionIndex < OPEN_LIMIT; selectionIndex += 1) {
        var swapIndex = selectionIndex + Math.floor(
          drawRandom(random) * (BOX_COUNT - selectionIndex)
        );
        var value = unopenedBoxes[selectionIndex];
        unopenedBoxes[selectionIndex] = unopenedBoxes[swapIndex];
        unopenedBoxes[swapIndex] = value;
      }

      var openedBoxes = [];
      var openedNumbers = [];

      for (var attempt = 0; attempt < OPEN_LIMIT; attempt += 1) {
        var selectedBox = unopenedBoxes[attempt];
        var cardNumber = permutation[selectedBox - 1];
        openedBoxes.push(selectedBox);
        openedNumbers.push(cardNumber);

        if (cardNumber === prisonerNumber) {
          break;
        }
      }

      prisoners.push(makePrisonerResult(prisonerNumber, openedBoxes, openedNumbers));
    }

    return makeStrategyResult("random", prisoners);
  }

  function runChainStrategy(permutation) {
    validatePermutation(permutation);
    var prisoners = [];

    for (var prisonerNumber = 1; prisonerNumber <= PRISONER_COUNT; prisonerNumber += 1) {
      var currentBox = prisonerNumber;
      var openedBoxes = [];
      var openedNumbers = [];

      for (var attempt = 0; attempt < OPEN_LIMIT; attempt += 1) {
        var cardNumber = permutation[currentBox - 1];
        openedBoxes.push(currentBox);
        openedNumbers.push(cardNumber);

        if (cardNumber === prisonerNumber) {
          break;
        }

        currentBox = cardNumber;
      }

      prisoners.push(makePrisonerResult(prisonerNumber, openedBoxes, openedNumbers));
    }

    return makeStrategyResult("chain", prisoners, analyzeCycles(permutation));
  }

  var api = {
    prisonerCount: PRISONER_COUNT,
    boxCount: BOX_COUNT,
    openLimit: OPEN_LIMIT,
    validatePermutation: validatePermutation,
    isValidPermutation: isValidPermutation,
    createPermutation: createPermutation,
    analyzeCycles: analyzeCycles,
    runRandomStrategy: runRandomStrategy,
    runChainStrategy: runChainStrategy
  };

  root.GameLogic = api;

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
}(typeof window !== "undefined" ? window : globalThis));
