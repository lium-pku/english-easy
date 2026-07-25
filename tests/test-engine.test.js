import { describe, it, expect, beforeEach } from 'vitest';
import { TestEngine } from '../public/js/test-engine.js';

function makeConfig() {
  return {
    bands: [
      { id: 1, range: [1, 1000], label: '1-1K', totalWords: 1000 },
      { id: 2, range: [1001, 2000], label: '1K-2K', totalWords: 1000 },
    ],
    questionsPerBand: 3,
  };
}

function makeBandData() {
  const questions1 = Array.from({ length: 10 }, (_, i) => ({
    word: `word${i}`,
    definition: `def${i}`,
    correctIndex: i % 5,
    options: ['a', 'b', 'c', 'd', '以上意思都不正确', '不认识'],
  }));
  const questions2 = Array.from({ length: 10 }, (_, i) => ({
    word: `word2${i}`,
    definition: `def2${i}`,
    correctIndex: i % 5,
    options: ['a', 'b', 'c', 'd', '以上意思都不正确', '不认识'],
  }));
  return {
    1: { band: 1, range: [1, 1000], label: '1-1K', totalWords: 1000, questions: questions1 },
    2: { band: 2, range: [1001, 2000], label: '1K-2K', totalWords: 1000, questions: questions2 },
  };
}

describe('TestEngine', () => {
  let engine;

  beforeEach(() => {
    engine = new TestEngine(makeConfig(), makeBandData());
  });

  describe('generateTest', () => {
    it('samples the configured number of questions per band', () => {
      engine.generateTest();
      expect(engine.totalQuestions).toBe(6);
    });

    it('respects custom questionsPerBand parameter', () => {
      engine.generateTest(5);
      expect(engine.totalQuestions).toBe(10);
    });

    it('initializes all answers to null', () => {
      engine.generateTest();
      expect(engine.answers.every(a => a === null)).toBe(true);
    });

    it('resets state on re-generation', () => {
      engine.generateTest();
      engine.selectAnswer(0);
      engine.next();
      engine.generateTest();
      expect(engine.currentIndex).toBe(0);
      expect(engine.answers.every(a => a === null)).toBe(true);
    });

    it('tags questions with band metadata', () => {
      engine.generateTest();
      for (const q of engine.questions) {
        expect(q.bandId).toBeDefined();
        expect(q.bandLabel).toBeDefined();
        expect(q.bandRange).toBeDefined();
      }
    });
  });

  describe('navigation', () => {
    beforeEach(() => engine.generateTest());

    it('starts at index 0', () => {
      expect(engine.currentIndex).toBe(0);
    });

    it('next() advances and returns true when not at end', () => {
      expect(engine.next()).toBe(true);
      expect(engine.currentIndex).toBe(1);
    });

    it('next() returns false at the last question', () => {
      for (let i = 0; i < engine.totalQuestions - 1; i++) engine.next();
      expect(engine.next()).toBe(false);
    });

    it('prev() goes back and returns true when not at start', () => {
      engine.next();
      expect(engine.prev()).toBe(true);
      expect(engine.currentIndex).toBe(0);
    });

    it('prev() returns false at the first question', () => {
      expect(engine.prev()).toBe(false);
    });
  });

  describe('selectAnswer', () => {
    beforeEach(() => engine.generateTest());

    it('records the selected option index', () => {
      engine.selectAnswer(3);
      expect(engine.answers[0]).toBe(3);
    });

    it('allows changing the answer', () => {
      engine.selectAnswer(1);
      engine.selectAnswer(4);
      expect(engine.answers[0]).toBe(4);
    });
  });

  describe('calculateResults', () => {
    beforeEach(() => engine.generateTest());

    it('returns zero estimate when all answers are wrong', () => {
      for (let i = 0; i < engine.totalQuestions; i++) {
        const q = engine.questions[i];
        const wrongIndex = (q.correctIndex + 1) % 6;
        engine.answers[i] = wrongIndex;
      }
      const results = engine.calculateResults();
      expect(results.totalEstimate).toBe(0);
      expect(results.totalCorrect).toBe(0);
    });

    it('returns full estimate when all answers are correct', () => {
      for (let i = 0; i < engine.totalQuestions; i++) {
        engine.answers[i] = engine.questions[i].correctIndex;
      }
      const results = engine.calculateResults();
      expect(results.totalEstimate).toBe(2000);
      expect(results.totalCorrect).toBe(6);
      expect(results.overallAccuracy).toBe(1);
    });

    it('calculates per-band accuracy correctly', () => {
      const band1Questions = engine.questions.filter(q => q.bandId === 1);
      for (let i = 0; i < engine.totalQuestions; i++) {
        const q = engine.questions[i];
        engine.answers[i] = q.bandId === 1 ? q.correctIndex : (q.correctIndex + 1) % 6;
      }
      const results = engine.calculateResults();
      const band1 = results.bandStats.find(b => b.id === 1);
      const band2 = results.bandStats.find(b => b.id === 2);
      expect(band1.accuracy).toBe(1);
      expect(band1.estimatedKnown).toBe(1000);
      expect(band2.accuracy).toBe(0);
      expect(band2.estimatedKnown).toBe(0);
    });

    it('counts unanswered questions as incorrect', () => {
      const results = engine.calculateResults();
      expect(results.totalCorrect).toBe(0);
      expect(results.totalAnswered).toBe(6);
    });

    it('treats selecting "不认识" (index 5) as incorrect', () => {
      for (let i = 0; i < engine.totalQuestions; i++) {
        engine.answers[i] = 5;
      }
      const results = engine.calculateResults();
      expect(results.totalCorrect).toBe(0);
    });

    it('treats selecting "以上意思都不正确" (index 4) as correct only for B-type questions', () => {
      for (let i = 0; i < engine.totalQuestions; i++) {
        engine.answers[i] = 4;
      }
      const results = engine.calculateResults();
      const bTypeCount = engine.questions.filter(q => q.correctIndex === 4).length;
      expect(results.totalCorrect).toBe(bTypeCount);
    });

    it('includes elapsed time in results', () => {
      engine.startTimer();
      engine.stopTimer();
      const results = engine.calculateResults();
      expect(results.elapsedTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('progress', () => {
    beforeEach(() => engine.generateTest());

    it('returns correct progress fraction', () => {
      expect(engine.progress).toBeCloseTo(1 / engine.totalQuestions);
      engine.next();
      expect(engine.progress).toBeCloseTo(2 / engine.totalQuestions);
    });
  });

  describe('currentBandInfo', () => {
    beforeEach(() => engine.generateTest());

    it('returns band label and position within band', () => {
      const info = engine.currentBandInfo;
      expect(info.label).toContain('Band');
      expect(info.indexInBand).toBe(1);
      expect(info.totalInBand).toBe(3);
    });
  });
});
