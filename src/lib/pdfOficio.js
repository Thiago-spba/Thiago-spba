// Estilo visual compartilhado dos relatórios em PDF (ofício formal),
// usado na Avaliação Descritiva do aluno, na exportação de notas da turma
// e no Relatório de Turma. Mantém tudo num único lugar pra não repetir
// código e pra manter os relatórios com a mesma identidade visual.
//
// Margens e tipografia seguem uma versão simplificada da ABNT: 2cm em
// todas as bordas (a ABNT pede 3cm/2cm assimétrico, mas isso desalinharia
// o layout dos modelos de referência — 2cm uniforme fica bem próximo do
// mínimo exigido e mantém a mesma proporção visual dos modelos),
// texto justificado, fonte sem serifa tamanho 12 no corpo e espaçamento
// 1,5 entre linhas nos parágrafos corridos.

import jsPDF from "jspdf"

export const OFICIO_MARGEM = 20 // mm, nas quatro bordas
export const OFICIO_COR_DESTAQUE = [178, 34, 34]   // vermelho da faixa lateral / títulos de seção
export const OFICIO_COR_CAIXA_BG = [243, 244, 246]  // fundo cinza-claro da caixa de identificação
export const OFICIO_COR_TEXTO_MUTED = [100, 116, 139]
export const OFICIO_COR_TEXTO = [30, 41, 59]

// Converte o valor salvo (string vinda do Firestore, pode ter "0", "08", "" etc.)
// num texto de exibição consistente: "-" quando não há nota lançada, ou
// "8,0" / "10,0" no padrão brasileiro quando há.
export function formatarNota(v) {
  if (v === "" || v === null || v === undefined) return "-"
  const n = Number(v)
  if (Number.isNaN(n)) return "-"
  return n.toFixed(1).replace(".", ",")
}

// Só pra EXIBIÇÃO nos relatórios: troca "3 Bimestre" por "3º Bimestre".
// O valor salvo no Firestore/localStorage (usado nas consultas) continua
// exatamente "1 Bimestre"/"2 Bimestre"/... sem essa formatação — só o texto
// impresso no PDF passa por aqui.
export function formatarBimestre(bimestre) {
  if (!bimestre) return ""
  const m = String(bimestre).match(/^(\d+)\s*(.*)$/)
  if (!m) return bimestre
  return `${m[1]}º ${m[2]}`.trim()
}

// Cabeçalho: nome da escola (editável em "🏫 Definir Escola" no menu Ações —
// se o professor mudar o nome ali, atualiza aqui automaticamente, sem
// precisar mexer em código) + subtítulo do tipo de relatório.
// margem é opcional (padrão = OFICIO_MARGEM/2cm, usado na Avaliação Descritiva).
// O Relatório de Notas passa uma margem menor pra ganhar largura pra tabela
// sem precisar diminuir a fonte.
export function desenharCabecalhoOficio(pdf, { escola, subtitulo, margem = OFICIO_MARGEM }) {
  const largura = pdf.internal.pageSize.getWidth()
  pdf.setTextColor(15, 23, 42)
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(15)
  pdf.text((escola || "E. E. Simão Mathias").toUpperCase(), largura / 2, 18, { align: "center" })
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(11)
  pdf.setTextColor(...OFICIO_COR_TEXTO_MUTED)
  pdf.text(subtitulo, largura / 2, 25, { align: "center" })
  pdf.setDrawColor(226, 232, 240)
  pdf.line(margem, 30, largura - margem, 30)
}

// Caixa de identificação (Professor/Aluno/Turma/Bimestre, ou Para/De/Turmas/Assunto)
// com a faixa vermelha à esquerda, igual ao modelo do professor.
// Retorna o Y livre logo abaixo da caixa, pra continuar o conteúdo.
export function desenharCaixaInfo(pdf, linhas, y = 36, margem = OFICIO_MARGEM) {
  const largura = pdf.internal.pageSize.getWidth()
  const alturaLinha = 6
  const altura = linhas.length * alturaLinha + 6
  pdf.setFillColor(...OFICIO_COR_CAIXA_BG)
  pdf.rect(margem, y, largura - margem * 2, altura, "F")
  pdf.setFillColor(...OFICIO_COR_DESTAQUE)
  pdf.rect(margem, y, 1.5, altura, "F")
  let cy = y + 7
  linhas.forEach(([label, valor]) => {
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(9.5); pdf.setTextColor(15, 23, 42)
    pdf.text(label, margem + 6, cy)
    pdf.setFont("helvetica", "normal"); pdf.setTextColor(51, 65, 85)
    pdf.text(String(valor), margem + 31, cy)
    cy += alturaLinha
  })
  return y + altura + 8
}

// Escreve um parágrafo corrido, justificado, fonte 12, espaçamento 1,5 —
// como pede a ABNT pra texto textual. Retorna o Y livre logo abaixo.
// tamanhoFonte/entrelinha são ajustáveis: por padrão 12pt/1,5 (ABNT, usado na
// Avaliação Descritiva, que tem espaço de sobra numa página). No Relatório de
// Notas (que precisa caber a lista inteira da turma numa página só), a
// chamada usa valores mais compactos — a regra dos 2cm/justificado continua
// valendo, só o espaçamento entre linhas fica mais enxuto.
export function escreverParagrafoJustificado(pdf, texto, y, { tamanhoFonte = 12, entrelinha = 1.5, margem = OFICIO_MARGEM } = {}) {
  const largura = pdf.internal.pageSize.getWidth()
  const larguraUtil = largura - margem * 2
  const alturaLinha = tamanhoFonte * entrelinha * 0.3528
  pdf.setFont("helvetica", "normal"); pdf.setFontSize(tamanhoFonte)
  pdf.setTextColor(...OFICIO_COR_TEXTO)
  pdf.setLineHeightFactor(entrelinha)
  const linhas = pdf.splitTextToSize(texto, larguraUtil)
  // IMPORTANTE: o jsPDF só aplica align:"justify" de verdade quando recebe o
  // ARRAY inteiro de linhas numa única chamada de pdf.text() — chamando linha
  // por linha (string única, como era antes) ele ignora o "justify" em
  // silêncio e cai no alinhamento padrão à esquerda (bug encontrado em
  // 26/09/2026: os relatórios pareciam não-justificados porque, na prática,
  // nunca estavam). A própria lib já cuida de deixar a ÚLTIMA linha do
  // parágrafo sem esticar — não precisa tratar isso manualmente.
  pdf.text(linhas, margem, y, {
    maxWidth: larguraUtil,
    align: "justify",
  })
  pdf.setLineHeightFactor(1.15) // volta ao padrão do jsPDF pro resto do documento
  return y + linhas.length * alturaLinha + 6
}

// Título de seção numerada (ex.: "1. Relato da Situação"), no mesmo
// vermelho da faixa lateral — usado no Relatório de Turma.
export function desenharTituloSecao(pdf, texto, y) {
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(12)
  pdf.setTextColor(...OFICIO_COR_DESTAQUE)
  pdf.text(texto, OFICIO_MARGEM, y)
  return y + 8
}

// Escolhe automaticamente o maior tamanho de fonte (de uma lista de
// candidatos, do maior pro menor) que ainda deixa a tabela caber numa
// página só — pra turmas pequenas a letra fica bem grande, pra turmas
// grandes vai encolhendo, e existe um "piso" (o último candidato da
// lista): se nem nesse tamanho mínimo a lista couber numa página, o
// relatório simplesmente ocupa mais de uma página — nunca fica menor
// que o piso, só pra não virar algo ilegível.
//
// `desenharTabela(pdfDeTeste, opcoes)` deve desenhar a tabela inteira
// (autoTable) na instância de pdf recebida, usando `opcoes` (por ex.
// { fontSize, cellPadding }). Essa função testa cada candidato numa
// instância de pdf "descartável" só pra contar quantas páginas deram,
// e devolve o primeiro `opcoes` da lista que resultou em 1 página só.
export function escolherTamanhoTabela(desenharTabela, candidatos) {
  for (const opcoes of candidatos) {
    const pdfTeste = new jsPDF()
    desenharTabela(pdfTeste, opcoes)
    if (pdfTeste.internal.getNumberOfPages() <= 1) return opcoes
  }
  return candidatos[candidatos.length - 1] // piso: aceita virar mais de uma página
}

// Rodapé com paginação, aplicado em todas as páginas já desenhadas do PDF.
// Chamar por último, depois que todo o conteúdo já foi montado.
export function desenharRodape(pdf, escola, margem = OFICIO_MARGEM) {
  const totalPaginas = pdf.internal.getNumberOfPages()
  const largura = pdf.internal.pageSize.getWidth()
  const altura = pdf.internal.pageSize.getHeight()
  for (let i = 1; i <= totalPaginas; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(226, 232, 240)
    pdf.line(margem, altura - 16, largura - margem, altura - 16)
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8)
    pdf.setTextColor(...OFICIO_COR_TEXTO_MUTED)
    pdf.text("Relatório Interno - " + (escola || "E. E. Simão Mathias"), margem, altura - 11)
    pdf.text(`Página ${i} de ${totalPaginas}`, largura - margem, altura - 11, { align: "right" })
  }
}
