import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const CACHE_FILE = join(__dirname, 'dict-cache.json');
const BANDS_DIR = join(ROOT, 'data', 'bands');

const BANDS = [
  { id: 1,  range: [1, 1000],     label: "1-1K",      totalWords: 1000 },
  { id: 2,  range: [1001, 2000],   label: "1K-2K",     totalWords: 1000 },
  { id: 3,  range: [2001, 3000],   label: "2K-3K",     totalWords: 1000 },
  { id: 4,  range: [3001, 5000],   label: "3K-5K",     totalWords: 2000 },
  { id: 5,  range: [5001, 7000],   label: "5K-7K",     totalWords: 2000 },
  { id: 6,  range: [7001, 10000],  label: "7K-10K",    totalWords: 3000 },
  { id: 7,  range: [10001, 15000], label: "10K-15K",   totalWords: 5000 },
  { id: 8,  range: [15001, 20000], label: "15K-20K",   totalWords: 5000 },
  { id: 9,  range: [20001, 25000], label: "20K-25K",   totalWords: 5000 },
  { id: 10, range: [25001, 32000], label: "25K-32K",   totalWords: 7000 },
  { id: 11, range: [32001, 40000], label: "32K-40K",   totalWords: 8000 },
];

function loadFrequencyData() {
  const subtlex = require('subtlex-word-frequencies');
  const valid = [];
  for (const entry of subtlex) {
    const lower = entry.word.toLowerCase();
    if (lower.length < 3 || lower.length > 20) continue;
    if (!/^[a-z]+$/.test(lower)) continue;
    valid.push({ word: lower, count: entry.count });
  }

  const seen = new Set();
  const deduped = [];
  for (const entry of valid) {
    if (seen.has(entry.word)) continue;
    seen.add(entry.word);
    deduped.push(entry);
  }

  return deduped;
}

function assignBands(freqList) {
  const bandMap = new Map();
  for (const band of BANDS) bandMap.set(band.id, []);

  for (let i = 0; i < freqList.length; i++) {
    const rank = i + 1;
    const entry = freqList[i];
    let bandId = null;
    for (const band of BANDS) {
      if (rank >= band.range[0] && rank <= band.range[1]) {
        bandId = band.id;
        break;
      }
    }
    if (bandId) {
      bandMap.get(bandId).push(entry.word);
    }
  }

  return bandMap;
}

function loadCache() {
  if (existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
    } catch { return {}; }
  }
  return {};
}

function saveCache(cache) {
  writeFileSync(CACHE_FILE, JSON.stringify(cache), 'utf-8');
}

function fetchDefinition(word) {
  return new Promise((resolve) => {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
    const req = https.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return; }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const meanings = json?.[0]?.meanings;
          if (!meanings?.length) { resolve(null); return; }
          const defs = meanings[0].definitions;
          resolve(defs?.[0]?.definition || null);
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function fetchWithRateLimit(words, cache) {
  const results = {};
  const toFetch = words.filter(w => !(w in cache));
  for (const w of words) {
    if (w in cache) results[w] = cache[w];
  }

  const total = toFetch.length;
  let fetched = 0;
  const CONCURRENCY = 3;
  const DELAY_MS = 200;

  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const batch = toFetch.slice(i, i + CONCURRENCY);
    const defs = await Promise.all(batch.map(w => fetchDefinition(w)));
    for (let j = 0; j < batch.length; j++) {
      const def = defs[j];
      if (def) {
        results[batch[j]] = def;
        cache[batch[j]] = def;
      }
      fetched++;
    }

    process.stdout.write(`\r  fetched ${Object.keys(results).length}/${words.length} definitions (${fetched} new, ${words.length - toFetch.length} cached)...`);

    if (i % (CONCURRENCY * 10) === 0) saveCache(cache);
    if (i + CONCURRENCY < toFetch.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  process.stdout.write('\n');
  saveCache(cache);
  return results;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateQuestions(bandWords, definitions) {
  const withDefs = bandWords.filter(w => definitions[w]);
  if (withDefs.length < 4) return [];

  const questions = [];
  const usedWords = new Set();

  for (const word of withDefs) {
    if (usedWords.has(word)) continue;

    const correctDef = definitions[word];
    const distractorPool = withDefs.filter(
      w => w !== word && !usedWords.has(w) && definitions[w] !== correctDef
    );
    if (distractorPool.length < 3) continue;

    const distractors = shuffle(distractorPool).slice(0, 3);
    const options = [correctDef, ...distractors.map(d => definitions[d])];
    const shuffledIndices = shuffle([0, 1, 2, 3]);
    const shuffledOptions = shuffledIndices.map(i => options[i]);
    const correctIndex = shuffledIndices.indexOf(0);

    questions.push({ word, definition: correctDef, correctIndex, options: shuffledOptions });
    usedWords.add(word);
  }

  return questions;
}

async function main() {
  console.log('=== English Vocabulary Test Data Generator (SUBTLEXus) ===\n');

  console.log('Loading SUBTLEXus frequency data...');
  const freqList = loadFrequencyData();
  console.log(`Loaded ${freqList.length} valid words (frequency-ranked)\n`);

  console.log('Assigning words to bands by frequency rank...');
  const bandMap = assignBands(freqList);
  for (const band of BANDS) {
    const count = bandMap.get(band.id).length;
    const sample = bandMap.get(band.id).slice(0, 5).join(', ');
    console.log(`  Band ${band.id} (${band.label}): ${count} words [e.g. ${sample}]`);
  }
  console.log();

  const cache = loadCache();
  console.log(`Loaded ${Object.keys(cache).length} cached definitions\n`);

  const TARGET_POOL_SIZE = 500;
  for (const band of BANDS) {
    const allWords = bandMap.get(band.id);
    const step = Math.max(1, Math.floor(allWords.length / TARGET_POOL_SIZE));
    const wordsToFetch = [];
    for (let i = 0; i < allWords.length && wordsToFetch.length < TARGET_POOL_SIZE; i += step) {
      wordsToFetch.push(allWords[i]);
    }
    console.log(`Band ${band.id} (${band.label}): ${allWords.length} total, sampling ${wordsToFetch.length} at step ${step}...`);
    await fetchWithRateLimit(wordsToFetch, cache);
    const withDefs = wordsToFetch.filter(w => cache[w]).length;
    console.log(`  -> ${withDefs} words have definitions\n`);
  }

  console.log('Generating questions and writing band files...\n');
  for (const band of BANDS) {
    const allWords = bandMap.get(band.id);
    const step = Math.max(1, Math.floor(allWords.length / TARGET_POOL_SIZE));
    const wordsForBand = [];
    for (let i = 0; i < allWords.length && wordsForBand.length < TARGET_POOL_SIZE; i += step) {
      wordsForBand.push(allWords[i]);
    }
    const definitions = {};
    for (const w of wordsForBand) {
      if (cache[w]) definitions[w] = cache[w];
    }

    const questions = generateQuestions(wordsForBand, definitions);
    const output = {
      band: band.id,
      range: band.range,
      label: band.label,
      totalWords: band.totalWords,
      questions,
    };

    const outFile = join(BANDS_DIR, `band-${band.id}.json`);
    writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`  Band ${band.id} (${band.label}): ${questions.length} questions -> ${outFile}`);
  }

  console.log('\n=== Done! ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
