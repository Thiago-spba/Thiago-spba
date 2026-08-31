export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { base64 } = req.body;
    if (!base64) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Chave de API não configurada.' });

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 2000,
        system: "Você é um processador de dados estrito. Sua ÚNICA função é retornar os nomes completos de alunos. É ESTRITAMENTE PROIBIDO incluir saudações, introduções, cabeçalhos do documento, numerações ou marcadores. Se não houver nomes, não escreva nada. Retorne estritamente um nome por linha e mais nada.",
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: 'Extraia os nomes dos alunos deste documento. Sem numeração, sem títulos, sem explicações.' }
            ]
          }
        ]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'Erro da API Anthropic');

    let texto = data.content?.find((b) => b.type === 'text')?.text || '';
    
    // Limpeza agressiva no backend (Regex)
    const lista = texto.split(/\r?\n/)
      // 1. Tira espaços em branco extras e remove números/pontos/hífens do começo do nome
      .map(n => n.trim().replace(/^[-*•\d.)]+\s*/, '')) 
      // 2. Só aceita linhas que tenham mais de 3 letras
      .filter(n => n.length > 3)
      // 3. Remove frases "educadas" da IA ou lixos comuns de cabeçalho
      .filter(n => !/^(aqui est|segue|abaixo|lista|nomes|claro|desculpe|aluno|turma|prof|data)/i.test(n))
      // 4. Remove qualquer linha que tenha apenas números
      .filter(n => !/^\d+$/.test(n));

    return res.status(200).json({ nomes: lista });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro interno ao processar PDF.' });
  }
}
