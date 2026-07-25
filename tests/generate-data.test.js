import { describe, it, expect } from 'vitest';
import {
  shuffle,
  generateQuestions,
  OPTION_NONE_CORRECT,
  OPTION_DONT_KNOW,
  NONE_CORRECT_RATIO,
} from '../scripts/generate-data.js';

function makeDefinitions(words) {
  const defs = {};
  for (const w of words) {
    defs[w] = `definition of ${w}`;
  }
  return defs;
}

describe('shuffle', () => {
  it('returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr)).toHaveLength(arr.length);
  });

  it('contains the same elements', () => {
    const arr = [1, 2, 3, 4, 5];
    expect(shuffle(arr).sort()).toEqual(arr.sort());
  });

  it('does not mutate the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = [...arr];
    shuffle(arr);
    expect(arr).toEqual(copy);
  });
});

describe('generateQuestions', () => {
  const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
  const definitions = makeDefinitions(words);

  it('returns empty array when fewer than 5 words have definitions', () => {
    const fewWords = ['a', 'b', 'c', 'd'];
    const fewDefs = makeDefinitions(fewWords);
    expect(generateQuestions(fewWords, fewDefs)).toEqual([]);
  });

  it('generates questions with exactly 6 options each', () => {
    const questions = generateQuestions(words, definitions);
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q.options).toHaveLength(6);
    }
  });

  it('always has the two fixed options at index 4 and 5', () => {
    const questions = generateQuestions(words, definitions);
    for (const q of questions) {
      expect(q.options[4]).toBe(OPTION_NONE_CORRECT);
      expect(q.options[5]).toBe(OPTION_DONT_KNOW);
    }
  });

  it('has correctIndex in valid range (0-4, never 5)', () => {
    const questions = generateQuestions(words, definitions);
    for (const q of questions) {
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThanOrEqual(4);
    }
  });

  it('A-type questions have the correct definition in options 0-3', () => {
    const questions = generateQuestions(words, definitions);
    const typeA = questions.filter(q => q.correctIndex < 4);
    expect(typeA.length).toBeGreaterThan(0);
    for (const q of typeA) {
      expect(q.options[q.correctIndex]).toBe(q.definition);
    }
  });

  it('B-type questions have correctIndex 4 and no correct definition in options 0-3', () => {
    const questions = generateQuestions(words, definitions);
    const typeB = questions.filter(q => q.correctIndex === 4);
    for (const q of typeB) {
      expect(q.options[4]).toBe(OPTION_NONE_CORRECT);
      for (let i = 0; i < 4; i++) {
        expect(q.options[i]).not.toBe(q.definition);
      }
    }
  });

  it('produces a reasonable A/B type ratio', () => {
    const largeWords = Array.from({ length: 200 }, (_, i) => `word${i}`);
    const largeDefs = makeDefinitions(largeWords);
    const questions = generateQuestions(largeWords, largeDefs);
    const typeB = questions.filter(q => q.correctIndex === 4);
    const ratio = typeB.length / questions.length;
    expect(ratio).toBeGreaterThan(NONE_CORRECT_RATIO - 0.15);
    expect(ratio).toBeLessThan(NONE_CORRECT_RATIO + 0.15);
  });

  it('does not reuse words across questions', () => {
    const questions = generateQuestions(words, definitions);
    const usedWords = questions.map(q => q.word);
    expect(new Set(usedWords).size).toBe(usedWords.length);
  });

  it('stores the actual correct definition in the definition field', () => {
    const questions = generateQuestions(words, definitions);
    for (const q of questions) {
      expect(q.definition).toBe(definitions[q.word]);
    }
  });
});
