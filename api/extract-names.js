export default async function handler(req, res) {
  // 1. Bloqueia qualquer requisição que não seja POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { base64 } = req.body;

    if (!base64) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    // Puxa a chave diretamente das variáveis de ambiente seguras da Vercel
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Chave de API não configurada no servidor.' });
    }

    // 2. Faz a requisição para a Anthropic de forma oculta do usuário
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
        // 'anthropic-dangerous-direct-browser-access' REMOVIDO pois agora é seguro
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: 'Extraia apenas os nomes completos dos alunos. Retorne SOMENTE os nomes, um por linha, sem numeração e sem textos adicionais.' }
            ]
          }
        ]
      })
    });

    const data = await resp.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Erro retornado pela API da Anthropic' });
    }

    // 3. Processa e devolve apenas o resultado limpo para o seu front-end
    const texto = data.content?.find((b) => b.type === 'text')?.text || '';
    const lista = texto.split(/\r?\n/).map((n) => n.trim()).filter((n) => n.length > 2);

    return res.status(200).json({ nomes: lista });

  } catch (error) {
    console.error('Erro no endpoint:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao processar o PDF.' });
  }
}
