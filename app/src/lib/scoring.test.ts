import { describe, expect, it } from "vitest";
import { guessExpectedValue, isCorrect, outcomeOf, scoreExercise } from "./scoring";

describe("isCorrect", () => {
  it("una sola resposta", () => {
    expect(isCorrect(["b"], ["b"])).toBe(true);
    expect(isCorrect(["a"], ["b"])).toBe(false);
  });
  it("diverses respostes: cal el conjunt exacte", () => {
    expect(isCorrect(["d", "a"], ["a", "d"])).toBe(true);
    expect(isCorrect(["a"], ["a", "d"])).toBe(false);
    expect(isCorrect(["a", "b", "d"], ["a", "d"])).toBe(false);
  });
  it("anul·lada mai és correcta", () => {
    expect(isCorrect(["a"], [])).toBe(false);
  });
});

describe("outcomeOf", () => {
  it("classifica blanc, anul·lada, correcta i errònia", () => {
    expect(outcomeOf([], ["a"], false)).toBe("blank");
    expect(outcomeOf(undefined, ["a"], false)).toBe("blank");
    expect(outcomeOf(["a"], [], true)).toBe("annulled");
    expect(outcomeOf(["a"], ["a"], false)).toBe("correct");
    expect(outcomeOf(["c"], ["a"], false)).toBe("wrong");
  });
});

describe("scoreExercise", () => {
  it("sense penalització escala sobre les vàlides i ignora les anul·lades", () => {
    const s = scoreExercise(["correct", "correct", "wrong", "blank", "annulled"], 0);
    expect(s.valid).toBe(4);
    expect(s.points).toBeCloseTo(25);
  });
  it("amb −1/4 resta els errors", () => {
    const s = scoreExercise(["correct", "correct", "correct", "wrong", "wrong", "wrong", "wrong", "blank"], 0.25);
    expect(s.net).toBeCloseTo(2);
    expect(s.points).toBeCloseTo((2 / 8) * 50);
  });
  it("no baixa de zero", () => {
    expect(scoreExercise(["wrong", "wrong"], 1).points).toBe(0);
  });
});

describe("guessExpectedValue", () => {
  it("sense penalització sempre convé respondre", () => {
    expect(guessExpectedValue(0)).toBeCloseTo(0.25);
  });
  it("amb −1/4 l'atzar pur ja és positiu", () => {
    expect(guessExpectedValue(0.25)).toBeCloseTo(0.0625);
  });
  it("amb −1/3 l'atzar pur és neutre i descartant-ne una és positiu", () => {
    expect(guessExpectedValue(1 / 3)).toBeCloseTo(0);
    expect(guessExpectedValue(1 / 3, 1)).toBeCloseTo(1 / 9);
  });
});
