import { createServer } from 'node:http';

const host = '127.0.0.1', port = Number(process.env.AIRBOARD_AI_PORT || 8787);
const provider = process.env.AIRBOARD_STT_PROVIDER || 'mock';
const key = process.env.OPENAI_API_KEY;
const configuredBudget = Number(process.env.AIRBOARD_DAILY_REQUEST_LIMIT || 100);
const maxBytes = 512_000, perMinute = 12, dailyBudget = Number.isInteger(configuredBudget) ? Math.min(1000, Math.max(1, configuredBudget)) : 100;
const origins = new Set(['http://127.0.0.1:5173', 'http://127.0.0.1:4173']);
let day = new Date().toISOString().slice(0, 10), requestsToday = 0;
const recent = [];
const log = (status, id) => console.info(`[airboard-ai] ${status} request=${id}`);
function send(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
function line(res, event) { res.write(JSON.stringify(event) + '\n'); }
async function readBody(req, signal) {
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    if (signal.aborted) throw new Error('Cancelled');
    bytes += chunk.length;
    if (bytes > maxBytes) throw new Error('Audio segment exceeds 512 KB');
    chunks.push(chunk);
  }
  if (bytes < 100) throw new Error('Audio segment is empty');
  const audio = Buffer.concat(chunks);
  const webm = audio.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  const ogg = audio.subarray(0, 4).toString('ascii') === 'OggS';
  if (!webm && !ogg) throw new Error('Invalid WebM or Ogg audio segment');
  return audio;
}
async function* mockTranscribe() {
  const text = (process.env.AIRBOARD_MOCK_TRANSCRIPT || 'AirBoard, create a flowchart with data collection, model training and deployment').slice(0, 500);
  yield { type: 'interim', text: text.slice(0, Math.ceil(text.length / 2)) };
  yield { type: 'final', text };
}
async function* openaiTranscribe(audio, mime, signal) {
  if (!key) throw new Error('OPENAI_API_KEY is required for the OpenAI provider');
  const form = new FormData();
  form.set('model', 'gpt-transcribe'); form.set('stream', 'true');
  form.set('prompt', 'A teacher gives AirBoard drawing commands in Hindi, English, and Hinglish. Preserve technical terms such as API, database, model training and deployment.');
  form.append('languages[]', 'hi'); form.append('languages[]', 'en');
  for (const word of ['AirBoard', 'API', 'database', 'model training', 'deployment']) form.append('keywords[]', word);
  form.set('file', new Blob([audio], { type: mime }), mime.includes('ogg') ? 'segment.ogg' : 'segment.webm');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form, signal });
  if (!response.ok || !response.body) throw new Error(`Transcription provider returned ${response.status}`);
  const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', interim = '', finalized = false;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
      const data = block.split('\n').filter(item => item.startsWith('data:')).map(item => item.slice(5).trim()).join('');
      if (!data || data === '[DONE]') continue;
      let event; try { event = JSON.parse(data); } catch { continue; }
      if (event.type === 'transcript.text.delta' && typeof event.delta === 'string') { interim = (interim + event.delta).slice(0, 500); yield { type: 'interim', text: interim }; }
      if (event.type === 'transcript.text.done' && typeof event.text === 'string') { finalized = true; yield { type: 'final', text: event.text.slice(0, 500) }; }
    }
  }
  if (!finalized) throw new Error('Transcription ended without a final result');
}
const providers = { mock: mockTranscribe, openai: openaiTranscribe };
createServer(async (req, res) => {
  const id = crypto.randomUUID().slice(0, 8), origin = req.headers.origin;
  if (origin && !origins.has(origin)) { send(res, 403, { error: 'Origin not allowed' }); return; }
  if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method === 'OPTIONS') { res.setHeader('Access-Control-Allow-Methods', 'POST'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/api/health') { if (provider === 'openai' && !key) send(res, 503, { error: 'Speech provider key is missing' }); else send(res, 200, { status: 'ok', provider }); return; }
  if (req.method !== 'POST' || req.url !== '/api/transcribe') { send(res, 404, { error: 'Not found' }); return; }
  const mime = String(req.headers['content-type'] || '').toLowerCase();
  if (!/^audio\/(webm|ogg)(;|$)/.test(mime) || Number(req.headers['content-length'] || 0) > maxBytes) { send(res, 415, { error: 'Send a WebM or Ogg audio segment under 512 KB' }); return; }
  const today = new Date().toISOString().slice(0, 10); if (today !== day) { day = today; requestsToday = 0; recent.length = 0; }
  const now = Date.now(); while (recent.length && recent[0] < now - 60_000) recent.shift();
  if (recent.length >= perMinute || requestsToday >= dailyBudget) { send(res, 429, { error: 'Transcription request budget reached' }); return; }
  if (!Object.hasOwn(providers, provider)) { send(res, 503, { error: 'Speech provider is not configured' }); return; }
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  req.on('aborted', () => controller.abort()); res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const audio = await readBody(req, controller.signal);
    recent.push(now); requestsToday++;
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' });
    for await (const event of providers[provider](audio, mime, controller.signal)) { if (controller.signal.aborted) break; line(res, event); }
    res.end(); log('ok', id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Transcription failed';
    if (res.headersSent) { line(res, { type: 'error', message }); res.end(); }
    else send(res, message.includes('512 KB') ? 413 : message.startsWith('Invalid WebM') || message.includes('empty') ? 400 : controller.signal.aborted ? 504 : 502, { error: message });
    log('error', id);
  } finally { clearTimeout(timer); }
}).listen(port, host, () => console.info(`[airboard-ai] listening on http://${host}:${port}; provider=${provider}; daily request cap=${dailyBudget}`));
