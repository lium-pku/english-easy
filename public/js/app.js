import { TestEngine } from './test-engine.js';
import { renderResults } from './results.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
const DEFINITION_OPTION_COUNT = 4;

let engine = null;
let timerInterval = null;

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function formatTimer(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function startTimer() {
  const timerEl = document.getElementById('timer');
  timerEl.classList.remove('hidden');
  engine.startTimer();
  timerInterval = setInterval(() => {
    timerEl.textContent = formatTimer(engine.elapsedTime);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  engine.stopTimer();
}

function renderQuestion() {
  const q = engine.currentQuestion;
  const bandInfo = engine.currentBandInfo;

  document.getElementById('question-word').textContent = q.word;
  document.getElementById('band-label').textContent = bandInfo.label;
  document.getElementById('question-counter').textContent = `${bandInfo.indexInBand} / ${bandInfo.totalInBand}`;
  document.getElementById('progress-fill').style.width = `${engine.progress * 100}%`;

  const container = document.getElementById('options-container');
  container.textContent = '';

  const currentAnswer = engine.answers[engine.currentIndex];

  q.options.forEach((opt, i) => {
    if (i === DEFINITION_OPTION_COUNT) {
      const sep = document.createElement('div');
      sep.className = 'options-separator';
      container.appendChild(sep);
    }

    const isSpecial = i >= DEFINITION_OPTION_COUNT;
    const btn = document.createElement('button');
    btn.className = (isSpecial ? 'option option-special' : 'option') + (currentAnswer === i ? ' selected' : '');
    btn.type = 'button';

    if (!isSpecial) {
      const letter = document.createElement('span');
      letter.className = 'option-letter';
      letter.textContent = LETTERS[i];
      btn.appendChild(letter);
    }

    const text = document.createElement('span');
    text.className = 'option-text';
    text.textContent = opt;
    btn.appendChild(text);

    btn.addEventListener('click', () => {
      engine.selectAnswer(i);
      container.querySelectorAll('.option').forEach(o => o.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('btn-next').disabled = false;
    });

    container.appendChild(btn);
  });

  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');

  btnPrev.disabled = engine.currentIndex === 0;

  const isLast = engine.currentIndex === engine.totalQuestions - 1;
  btnNext.textContent = isLast ? 'Finish' : 'Next';
  btnNext.disabled = currentAnswer === null;
}

async function init() {
  document.getElementById('btn-start').addEventListener('click', startTest);
  document.getElementById('btn-prev').addEventListener('click', () => {
    if (engine.prev()) renderQuestion();
  });
  document.getElementById('btn-next').addEventListener('click', () => {
    if (engine.next()) {
      renderQuestion();
    } else {
      finishTest();
    }
  });
  document.getElementById('btn-restart').addEventListener('click', () => {
    showScreen('screen-landing');
    document.getElementById('timer').classList.add('hidden');
  });
}

async function startTest() {
  try {
    engine = await TestEngine.init('../data/config.json');
    engine.generateTest();
    showScreen('screen-test');
    startTimer();
    renderQuestion();
  } catch (err) {
    console.error('Failed to initialize test:', err);
    alert('Failed to load test data. Please make sure you have run "npm run generate" first.');
  }
}

function finishTest() {
  stopTimer();
  const results = engine.calculateResults();
  showScreen('screen-results');
  renderResults(results);
}

init();
