"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var GameLogic = require("./game.js");
var Tournament = require("./tournament.js");

function createQueueScheduler() {
  var queue = [];
  return {
    schedule: function (callback) {
      queue.push(callback);
      return callback;
    },
    cancel: function (callback) {
      var index = queue.indexOf(callback);
      if (index !== -1) { queue.splice(index, 1); }
    },
    runNext: function () {
      var callback = queue.shift();
      if (!callback) { return false; }
      callback();
      return true;
    },
    runAll: function (limit) {
      var count = 0;
      while (this.runNext()) {
        count += 1;
        if (count > (limit || 1005)) {
          throw new Error("Очередь турнира не завершилась.");
        }
      }
      return count;
    }
  };
}

function identityPermutation() {
  return Array.from({ length: 100 }, function (_, index) { return index + 1; });
}

function createFakeResult(strategy, won, successfulPrisoners) {
  return {
    strategy: strategy,
    won: won,
    successfulPrisoners: successfulPrisoners,
    prisoners: Array.from({ length: 100 }, function (_, index) {
      return { prisonerNumber: index + 1, success: won };
    })
  };
}

function createFakeGame(randomOutcomes, chainOutcomes) {
  var createdPermutations = [];
  var randomInputs = [];
  var chainInputs = [];
  var randomIndex = 0;
  var chainIndex = 0;

  return {
    createdPermutations: createdPermutations,
    randomInputs: randomInputs,
    chainInputs: chainInputs,
    createPermutation: function () {
      var permutation = identityPermutation();
      createdPermutations.push(permutation);
      return permutation;
    },
    runRandomStrategy: function (permutation) {
      randomInputs.push(permutation);
      var won = randomOutcomes[randomIndex++];
      return createFakeResult("random", won, won ? 100 : 50);
    },
    runChainStrategy: function (permutation) {
      chainInputs.push(permutation);
      var won = chainOutcomes[chainIndex++];
      return createFakeResult("chain", won, won ? 100 : 49);
    }
  };
}

function createController(game, scheduler, randomSource) {
  return Tournament.createController({
    gameLogic: game,
    randomSource: randomSource,
    schedule: scheduler.schedule,
    cancelSchedule: scheduler.cancel
  });
}

function testRoundCountValidation() {
  [1, 100, 1000].forEach(function (roundCount) {
    assert.doesNotThrow(function () { Tournament.validateRoundCount(roundCount); });
  });
  [0, 1001, 1.5, NaN, "2", "", null, undefined].forEach(function (roundCount) {
    assert.throws(function () { Tournament.validateRoundCount(roundCount); }, /от 1 до 1000/);
  });
}

function testSharedPermutationAndStatistics() {
  var scheduler = createQueueScheduler();
  var game = createFakeGame([true, false], [false, true]);
  var controller = createController(game, scheduler);
  var updates = [];

  controller.start(2, { onUpdate: function (state) { updates.push(state); } });
  assert.equal(controller.getState().status, "running");
  assert.throws(function () { controller.start(1); }, /уже выполняется/);
  assert.throws(function () { controller.reset(); }, /без прерывания/);

  assert.equal(scheduler.runNext(), true);
  var afterFirstRound = controller.getState();
  assert.equal(afterFirstRound.status, "running");
  assert.equal(afterFirstRound.completedRounds, 1);
  assert.equal(afterFirstRound.randomWins, 1);
  assert.equal(afterFirstRound.chainWins, 0);
  assert.equal(afterFirstRound.randomRate, 100);
  assert.equal(afterFirstRound.chainRate, 0);
  assert.equal(afterFirstRound.rounds.length, 1);

  assert.equal(scheduler.runNext(), true);
  var finalState = controller.getState();
  assert.equal(finalState.status, "completed");
  assert.equal(finalState.completedRounds, 2);
  assert.equal(finalState.randomWins, 1);
  assert.equal(finalState.chainWins, 1);
  assert.equal(finalState.randomRate, 50);
  assert.equal(finalState.chainRate, 50);
  assert.equal(finalState.rounds.length, 2);
  assert.equal(scheduler.runNext(), false);
  assert.equal(updates.length, 3);

  assert.equal(game.createdPermutations.length, 2);
  assert.strictEqual(game.randomInputs[0], game.createdPermutations[0]);
  assert.strictEqual(game.chainInputs[0], game.createdPermutations[0]);
  assert.strictEqual(game.randomInputs[1], game.createdPermutations[1]);
  assert.strictEqual(game.chainInputs[1], game.createdPermutations[1]);
  assert.deepEqual(game.createdPermutations[0], identityPermutation());
  assert.deepEqual(finalState.rounds[0].randomResult, { won: true, successfulPrisoners: 100 });
  assert.equal(Object.prototype.hasOwnProperty.call(finalState.rounds[0].randomResult, "prisoners"), false);
}

function testOneThousandRoundsAndAbort() {
  var scheduler = createQueueScheduler();
  var outcomes = Array.from({ length: 1000 }, function (_, index) { return index % 2 === 0; });
  var game = createFakeGame(outcomes, outcomes);
  var controller = createController(game, scheduler);

  controller.start(1000);
  scheduler.runAll(1000);

  var completed = controller.getState();
  assert.equal(completed.status, "completed");
  assert.equal(completed.selectedRounds, 1000);
  assert.equal(completed.completedRounds, 1000);
  assert.equal(completed.rounds.length, 1000);
  assert.equal(completed.randomWins, 500);
  assert.equal(completed.chainWins, 500);
  assert.equal(completed.randomRate, 50);
  assert.equal(completed.chainRate, 50);
  assert.equal(Object.prototype.hasOwnProperty.call(completed.rounds[999].chainResult, "prisoners"), false);

  var abortScheduler = createQueueScheduler();
  var abortGame = createFakeGame([true, false], [false, true]);
  var abortController = createController(abortGame, abortScheduler);
  abortController.start(1000);
  assert.equal(abortScheduler.runNext(), true);
  assert.equal(abortController.getState().completedRounds, 1);
  assert.equal(abortController.abort(), true);

  var aborted = abortController.getState();
  assert.equal(aborted.status, "aborted");
  assert.equal(aborted.completedRounds, 1);
  assert.equal(aborted.rounds.length, 1);
  assert.equal(abortScheduler.runNext(), false);
}

function testEmptyStatisticsAndReset() {
  var scheduler = createQueueScheduler();
  var game = createFakeGame([false], [false]);
  var controller = createController(game, scheduler);

  var initial = controller.getState();
  assert.equal(initial.completedRounds, 0);
  assert.equal(initial.randomRate, null);
  assert.equal(initial.chainRate, null);

  controller.start(1);
  scheduler.runAll();
  var result = controller.getState();
  assert.equal(result.randomWins, 0);
  assert.equal(result.chainWins, 0);
  assert.equal(result.randomRate, 0);
  assert.equal(result.chainRate, 0);
  assert.deepEqual(result.rounds[0].randomResult, { won: false, successfulPrisoners: 50 });

  var reset = controller.reset();
  assert.equal(reset.status, "idle");
  assert.equal(reset.completedRounds, 0);
  assert.equal(reset.randomWins, 0);
  assert.equal(reset.randomRate, null);
  assert.equal(reset.rounds.length, 0);
}

function testRealGameLogicIntegration() {
  var scheduler = createQueueScheduler();
  var controller = createController(GameLogic, scheduler, function () { return 0; });
  controller.start(1);
  scheduler.runAll();

  var state = controller.getState();
  assert.equal(state.status, "completed");
  assert.equal(state.completedRounds, 1);
  assert.deepEqual(Object.keys(state.rounds[0].randomResult).sort(), ["successfulPrisoners", "won"]);
  assert.deepEqual(Object.keys(state.rounds[0].chainResult).sort(), ["successfulPrisoners", "won"]);
}

function testSimplifiedMarkup() {
  var html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  var renderer = fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8");
  var styles = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  var app = fs.readFileSync(path.join(__dirname, "app.js"), "utf8");

  assert.match(html, /id="round-count"[^>]*min="1"[^>]*max="1000"[^>]*step="1"[^>]*value="100"[^>]*required/);
  assert.match(html, /от 1 до 1000 раундов/);
  assert.match(html, /id="round-results"/);
  assert.match(html, /id="random-rate"/);
  assert.match(html, /id="chain-rate"/);
  assert.doesNotMatch(html, /class="strategies"|random-panel-wins|chain-panel-wins|scene-placeholder|playback-(?:pause|resume|step|speed)/);
  assert.doesNotMatch(renderer, /random-panel-wins|chain-panel-wins|scene-placeholder|playback-(?:pause|resume|step|speed)/);
  assert.doesNotMatch(styles, /\.strategies|\.strategy-panel|\.strategy-heading|\.strategy-mark|\.scene-placeholder|\.panel-footer/);
  assert.doesNotMatch(app, /playback-(?:pause|resume|step|speed)|\.step\(/);
}

testRoundCountValidation();
testSharedPermutationAndStatistics();
testOneThousandRoundsAndAbort();
testEmptyStatisticsAndReset();
testRealGameLogicIntegration();
testSimplifiedMarkup();

console.log("Все тесты турнира и упрощённого интерфейса пройдены.");
