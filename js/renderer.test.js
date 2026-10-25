"use strict";

var assert = require("node:assert/strict");
var fs = require("node:fs");
var path = require("node:path");
var vm = require("node:vm");

function createElement(tagName) {
  var element = {
    tagName: tagName,
    children: [],
    attributes: {},
    textContent: "",
    className: "",
    hidden: false,
    disabled: false,
    value: "",
    appendChild: function (child) {
      this.children.push(child);
      return child;
    },
    removeChild: function (child) {
      var index = this.children.indexOf(child);
      if (index !== -1) { this.children.splice(index, 1); }
      return child;
    },
    setAttribute: function (name, value) {
      this.attributes[name] = value;
    }
  };
  Object.defineProperty(element, "firstChild", {
    get: function () { return this.children.length ? this.children[0] : null; }
  });
  return element;
}

function makeState(rounds, status) {
  var randomWins = rounds.filter(function (round) { return round.randomResult.won; }).length;
  var chainWins = rounds.filter(function (round) { return round.chainResult.won; }).length;
  var count = rounds.length;
  return {
    status: status || (count ? "running" : "idle"),
    selectedRounds: 1000,
    completedRounds: count,
    rounds: rounds,
    randomWins: randomWins,
    chainWins: chainWins,
    randomRate: count ? randomWins / count * 100 : null,
    chainRate: count ? chainWins / count * 100 : null,
    errorMessage: ""
  };
}

var elementIds = [
  "round-count", "tournament-start", "tournament-abort", "tournament-new", "setup-status",
  "tournament-progress", "completed-rounds", "random-wins", "chain-wins", "random-rate",
  "chain-rate", "round-results"
];
var elements = {};
elementIds.forEach(function (id) { elements[id] = createElement("div"); });
var document = {
  getElementById: function (id) { return elements[id] || null; },
  createElement: createElement
};
var window = {};
var rendererSource = fs.readFileSync(path.join(__dirname, "renderer.js"), "utf8");
vm.runInNewContext(rendererSource, { window: window, document: document }, { filename: "renderer.js" });

var rounds = [];
window.TournamentRenderer.render(makeState(rounds));
assert.equal(elements["round-results"].children.length, 1);
assert.equal(elements["round-results"].children[0].children[0].textContent, "Турнир ещё не запущен");
assert.equal(elements["random-rate"].textContent, "Частота: —");

var firstRow = null;
for (var roundNumber = 1; roundNumber <= 1000; roundNumber += 1) {
  rounds.push({
    roundNumber: roundNumber,
    randomResult: { won: roundNumber % 2 === 0, successfulPrisoners: roundNumber % 2 === 0 ? 100 : 42 },
    chainResult: { won: true, successfulPrisoners: 100 }
  });
  window.TournamentRenderer.render(makeState(rounds));
  if (roundNumber === 1) {
    firstRow = elements["round-results"].children[0];
  }
  if (roundNumber === 2) {
    assert.strictEqual(elements["round-results"].children[0], firstRow, "новый раунд не должен перестраивать уже выведенные строки");
  }
}

assert.equal(elements["round-results"].children.length, 1000);
assert.equal(elements["completed-rounds"].textContent, "1000");
assert.equal(elements["random-wins"].textContent, "500");
assert.equal(elements["chain-wins"].textContent, "1000");
assert.equal(elements["random-rate"].textContent, "Частота: 50.0%");
assert.equal(elements["chain-rate"].textContent, "Частота: 100.0%");
assert.equal(elements["round-results"].children[999].children[0].textContent, "1000");

window.TournamentRenderer.render(makeState([], "idle"));
assert.equal(elements["round-results"].children.length, 1);
assert.equal(elements["round-results"].children[0].children[0].textContent, "Турнир ещё не запущен");

console.log("Все тесты рендерера и таблицы пройдены.");
