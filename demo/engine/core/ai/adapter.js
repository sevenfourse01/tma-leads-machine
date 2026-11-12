// Swappable AI. One small adapter; the system runs with it switched off, and it is off by default.
// The data rule: no enquiry text through US AI services. Until the solicitor's data sheet names a UK or EU
// processor, only 'none', the test 'fixture', and a local model ('ollama', text never leaves the machine)
// can be constructed. 'anthropic' and other hosted US services refuse to construct here.
//
// classify({ text }) -> { label: 'routine' | 'unclear', confidence: 0..1, fit?: { treatment, timing } } | null

export function createAi(config, { fetchImpl } = {}) {
  const a = (config && config.ai) || { adapter: 'none' };
  const adapter = a.adapter || 'none';

  if (adapter === 'none') {
    return { enabled: false, name: 'none', classify: async () => null };
  }

  if (adapter === 'fixture') {
    const answers = a.fixtureAnswers || [];
    return {
      enabled: true,
      name: 'fixture',
      classify: async ({ text }) => {
        const lower = String(text || '').toLowerCase();
        const hit = answers.find((x) => lower.includes(String(x.when).toLowerCase()));
        return hit ? { label: hit.label, confidence: hit.confidence, fit: hit.fit || {} } : { label: 'unclear', confidence: 0.3 };
      },
    };
  }

  if (adapter === 'ollama') {
    const base = a.baseUrl || 'http://127.0.0.1:11434';
    const model = a.model || 'qwen3.5:4b';
    const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) throw new Error('ollama adapter needs fetch.');
    return {
      enabled: true,
      name: `ollama:${model}`,
      classify: async ({ text }) => {
        const prompt = [
          'You sort dental clinic enquiries. Answer with one JSON object and nothing else:',
          '{"label":"routine"|"unclear","confidence":0..1,"treatment":string|null,"timing":string|null}',
          'routine = asking about prices, booking, availability, a named treatment, opening hours, location, payment plans, with no symptoms, pain, medication, results or urgency.',
          'unclear = anything else, or anything you are not sure about. Never give advice.',
          `Enquiry: ${JSON.stringify(String(text || '').slice(0, 1500))}`,
        ].join('\n');
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), a.timeoutMs || 8000);
          const res = await doFetch(`${base}/api/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, prompt, stream: false, format: 'json', options: { temperature: 0 } }), signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return null;
          const data = await res.json();
          const parsed = JSON.parse(data.response || '{}');
          if (parsed.label !== 'routine' && parsed.label !== 'unclear') return null;
          return { label: parsed.label, confidence: Number(parsed.confidence) || 0, fit: { treatment: parsed.treatment || null, timing: parsed.timing || null } };
        } catch {
          return null;
        }
      },
    };
  }

  const processor = a.processor || {};
  const approved = processor.approvedInDataSheet === true && ['UK', 'EU'].includes(processor.region);
  if (!approved) {
    throw new Error(`AI adapter '${adapter}' refused: the data rule allows only a UK or EU processor named in the solicitor's data sheet (config.ai.processor.region and approvedInDataSheet). Set ai.adapter to 'none' to run on rules alone.`);
  }
  throw new Error(`AI adapter '${adapter}' is not built yet. Add it behind this same interface once the processor is approved.`);
}
