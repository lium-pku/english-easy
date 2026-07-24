export class TestEngine {
  constructor(config, bandData) {
    this.config = config;
    this.bandData = bandData;
    this.questions = [];
    this.answers = [];
    this.currentIndex = 0;
    this.startTime = null;
    this.endTime = null;
  }

  static async init(configUrl = '../data/config.json') {
    const configRes = await fetch(configUrl);
    const config = await configRes.json();

    const bandData = {};
    for (const band of config.bands) {
      const res = await fetch(`../data/bands/band-${band.id}.json`);
      bandData[band.id] = await res.json();
    }

    return new TestEngine(config, bandData);
  }

  generateTest(questionsPerBand = null) {
    this.questions = [];
    this.answers = [];
    this.currentIndex = 0;

    const qpb = questionsPerBand || this.config.questionsPerBand;

    for (const band of this.config.bands) {
      const data = this.bandData[band.id];
      if (!data || !data.questions.length) continue;

      const sampled = this._sample(data.questions, Math.min(qpb, data.questions.length));
      for (const q of sampled) {
        this.questions.push({
          ...q,
          bandId: band.id,
          bandLabel: band.label,
          bandRange: band.range,
        });
      }
    }

    this.answers = new Array(this.questions.length).fill(null);
    return this;
  }

  _sample(arr, n) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, n);
  }

  get totalQuestions() {
    return this.questions.length;
  }

  get currentQuestion() {
    return this.questions[this.currentIndex];
  }

  get progress() {
    return (this.currentIndex + 1) / this.totalQuestions;
  }

  get currentBandInfo() {
    const q = this.currentQuestion;
    const bandQuestions = this.questions.filter(qq => qq.bandId === q.bandId);
    const indexInBand = bandQuestions.indexOf(q);
    return {
      label: `Band ${q.bandId}: ${q.bandLabel}`,
      indexInBand: indexInBand + 1,
      totalInBand: bandQuestions.length,
    };
  }

  selectAnswer(optionIndex) {
    this.answers[this.currentIndex] = optionIndex;
  }

  next() {
    if (this.currentIndex < this.totalQuestions - 1) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return true;
    }
    return false;
  }

  startTimer() {
    this.startTime = Date.now();
  }

  stopTimer() {
    this.endTime = Date.now();
  }

  get elapsedTime() {
    const end = this.endTime || Date.now();
    return end - (this.startTime || end);
  }

  calculateResults() {
    const bandStats = {};

    for (const band of this.config.bands) {
      bandStats[band.id] = {
        id: band.id,
        label: band.label,
        range: band.range,
        totalWords: band.totalWords,
        correct: 0,
        total: 0,
        accuracy: 0,
        estimatedKnown: 0,
      };
    }

    for (let i = 0; i < this.questions.length; i++) {
      const q = this.questions[i];
      const answer = this.answers[i];
      const stat = bandStats[q.bandId];
      stat.total++;
      if (answer === q.correctIndex) {
        stat.correct++;
      }
    }

    let totalEstimate = 0;
    for (const stat of Object.values(bandStats)) {
      stat.accuracy = stat.total > 0 ? stat.correct / stat.total : 0;
      stat.estimatedKnown = Math.round(stat.accuracy * stat.totalWords);
      totalEstimate += stat.estimatedKnown;
    }

    const totalCorrect = Object.values(bandStats).reduce((s, b) => s + b.correct, 0);
    const totalAnswered = Object.values(bandStats).reduce((s, b) => s + b.total, 0);

    return {
      totalEstimate,
      bandStats: Object.values(bandStats),
      totalCorrect,
      totalAnswered,
      overallAccuracy: totalAnswered > 0 ? totalCorrect / totalAnswered : 0,
      elapsedTime: this.elapsedTime,
      benchmarks: this.config.bands[0].benchmarks || {},
    };
  }
}
