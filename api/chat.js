export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Mensagem não fornecida' });
  }

  // Validação Fail-fast: Verifica se a variável de ambiente foi carregada pela Vercel
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Falha Crítica: ANTHROPIC_API_KEY ausente nas variáveis de ambiente.");
    return res.status(500).json({ error: 'Erro de configuração no servidor.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
        // O cabeçalho 'anthropic-workspace-id' foi intencionalmente removido
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', 
        max_tokens: 1024,
        messages: [{ role: 'user', content: message }]
      })
    });

    const data = await response.json();

    // Se a API da Anthropic retornar erro, repassamos o erro exato para facilitar o diagnóstico
    if (!response.ok) {
      console.error("Erro retornado pela Anthropic:", data);
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error("Erro interno da função Serverless:", error);
    res.status(500).json({ error: 'Falha de rede ou erro interno no servidor.' });
  }
}