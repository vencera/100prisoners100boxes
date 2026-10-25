"use strict";

var assert = require("node:assert/strict");
var GameLogic = require("./game.js");

function identityPermutation() {
  return Array.from({ length: GameLogic.boxCount }, function (_, index) {
    return index + 1;
  });
}

function permutationWithCycle(length) {
  var permutation = identityPermutation();

  for (var number = 1; number <= length; number += 1) {
    permutation[number - 1] = number === length ? 1 : number + 1;
  }

  return permutation;
}

function constantRandom(value) {
  return function () {
    return value;
  };
}

function testPermutationGenerationAndValidation() {
  var first = GameLogic.createPermutation(constantRandom(0));
  var second = GameLogic.createPermutation(constantRandom(0));

  assert.deepEqual(first, second, "одинаковый генератор должен давать одинаковую перестановку");
  assert.equal(first.length, 100);
  assert.equal(GameLogic.isValidPermutation(first), true);
  assert.equal(new Set(first).size, 100);
  assert.deepEqual(first.slice().sort(function (a, b) { return a - b; }), identityPermutation());

  assert.throws(function () { GameLogic.validatePermutation([]); }, /массивом из 100/);
  assert.throws(function () { GameLogic.validatePermutation([1, 1].concat(identityPermutation().slice(2))); }, /повторяющиеся/);
  assert.throws(function () {
    var invalid = identityPermutation();
    invalid[0] = 1.5;
    GameLogic.validatePermutation(invalid);
  }, /целый номер/);
  assert.throws(function () {
    var invalid = identityPermutation();
    invalid[0] = NaN;
    GameLogic.validatePermutation(invalid);
  }, /целый номер/);
  assert.throws(function () {
    var invalid = identityPermutation();
    invalid[0] = 101;
    GameLogic.validatePermutation(invalid);
  }, /целый номер/);
  assert.throws(function () { GameLogic.createPermutation(1); }, /должен быть функцией/);
  assert.throws(function () { GameLogic.createPermutation(constantRandom(1)); }, /диапазоне \[0, 1\)/);
  assert.throws(function () { GameLogic.createPermutation(constantRandom(NaN)); }, /диапазоне \[0, 1\)/);
}

function testChainStrategy() {
  var identity = identityPermutation();
  var chainResult = GameLogic.runChainStrategy(identity);

  assert.equal(chainResult.won, true);
  assert.equal(chainResult.successfulPrisoners, 100);
  assert.equal(chainResult.totalOpens, 100);
  assert.equal(chainResult.maxCycleLength, 1);
  assert.equal(chainResult.prisoners.length, 100);
  assert.deepEqual(chainResult.prisoners[0].openedBoxes, [1]);
  assert.deepEqual(chainResult.prisoners[0].openedNumbers, [1]);
  assert.equal(chainResult.prisoners[0].foundNumber, 1);

  var cycle50 = GameLogic.runChainStrategy(permutationWithCycle(50));
  assert.equal(cycle50.won, true);
  assert.equal(cycle50.successfulPrisoners, 100);
  assert.equal(cycle50.maxCycleLength, 50);
  assert.equal(cycle50.prisoners[0].openCount, 50);

  var cycle51 = GameLogic.runChainStrategy(permutationWithCycle(51));
  assert.equal(cycle51.won, false);
  assert.equal(cycle51.successfulPrisoners, 49);
  assert.equal(cycle51.prisoners.length, 100);
  assert.equal(cycle51.maxCycleLength, 51);
  assert.equal(cycle51.prisoners[0].success, false);
  assert.equal(cycle51.prisoners[0].openCount, 50);
  assert.equal(cycle51.prisoners[50].success, false);
  assert.equal(cycle51.prisoners[51].success, true);
  assert.equal(cycle51.prisoners[51].openCount, 1);
}

function testRandomStrategy() {
  var permutation = identityPermutation();
  var original = permutation.slice();
  var result = GameLogic.runRandomStrategy(permutation, constantRandom(0));

  assert.equal(result.won, false);
  assert.equal(result.successfulPrisoners, 50);
  assert.equal(result.prisoners.length, 100);
  assert.equal(result.totalOpens, 3775);
  assert.equal(result.prisoners[0].success, true);
  assert.equal(result.prisoners[0].openCount, 1);
  assert.equal(result.prisoners[49].success, true);
  assert.equal(result.prisoners[49].openCount, 50);
  assert.equal(result.prisoners[50].success, false);
  assert.equal(result.prisoners[50].openCount, 50);
  assert.equal(result.prisoners[50].foundNumber, null);

  result.prisoners.forEach(function (prisoner) {
    assert.ok(prisoner.openCount >= 1 && prisoner.openCount <= 50);
    assert.equal(new Set(prisoner.openedBoxes).size, prisoner.openCount);
    assert.equal(prisoner.openedNumbers.length, prisoner.openCount);

    prisoner.openedBoxes.forEach(function (boxNumber, index) {
      assert.equal(permutation[boxNumber - 1], prisoner.openedNumbers[index]);
    });
  });

  assert.deepEqual(permutation, original, "стратегия не должна менять входную раскладку");
  assert.throws(function () {
    GameLogic.runRandomStrategy(permutation, constantRandom(-0.1));
  }, /диапазоне \[0, 1\)/);
}

function testBothStrategiesCanSharePermutation() {
  var permutation = permutationWithCycle(50);
  var original = permutation.slice();
  var randomResult = GameLogic.runRandomStrategy(permutation, constantRandom(0.25));
  var chainResult = GameLogic.runChainStrategy(permutation);

  assert.equal(randomResult.prisoners.length, 100);
  assert.equal(chainResult.prisoners.length, 100);
  assert.equal(chainResult.won, true);
  assert.deepEqual(permutation, original);

  var repeated = GameLogic.runRandomStrategy(permutation, constantRandom(0.25));
  assert.deepEqual(repeated, randomResult, "повторный прогон с тем же генератором должен совпадать");
}

testPermutationGenerationAndValidation();
testChainStrategy();
testRandomStrategy();
testBothStrategiesCanSharePermutation();

console.log("Все тесты игровой логики пройдены.");
