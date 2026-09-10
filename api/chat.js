export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { prompt, model = 'claude-haiku-4-5-20251001', max_tokens = 600 } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt não fornecido.' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Chave de API não configurada.' });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'Erro da API Anthropic');

    const texto = data.content?.find((b) => b.type === 'text')?.text || '';
    return res.status(200).json({ texto });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao gerar relatório.' });
  }
}
