import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs, setDoc, getDoc } from "firebase/firestore"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

const BIMESTRES = ["1 Bimestre","2 Bimestre","3 Bimestre","4 Bimestre"]
const CRITERIOS = ["atividades","participacao","comportamento"]
const LABELS    = ["Atividades","Participação","Comportamento"]

function corNota(n) {
  if (n==="" || n===null || n===undefined) return ""
  const v = Number(n)
  if (v<=4) return "nota-insuf"
  if (v<=6) return "nota-reg"
  if (v<=8) return "nota-bom"
  return "nota-otimo"
}

function credenciais(tipo) {
  return tipo==="tecnica"
    ? "Graduando em Engenharia de Computação, Licenciado em Matemática"
    : "Licenciado em História, Pós-graduado em Metodologia de Ensino"
}

function limparMarkdown(t) {
  return t
    .replace(/\*\*(.*?)\*\*/g,"$1")
    .replace(/\*(.*?)\*/g,"$1")
    .replace(/#{1,6}\s/g,"")
    .replace(/---/g,"—")
    .replace(/^\s*[-*]\s/gm,"")
    .trim()
}

export default function PlanilhaPage({ turma }) {
  const [bimestre, setBimestre]             = useState(() => localStorage.getItem(`bimestre_${turma.id}`) || "1 Bimestre")
  const [alunos, setAlunos]                 = useState([])
  const [notas, setNotas]                   = useState({})
  const [local, setLocal]                   = useState({})
  const [nome, setNome]                     = useState("")
  const [menu, setMenu]                     = useState(false)
  const [importando, setImportando]         = useState(false)
  const [nomesEditados, setNomesEditados]   = useState([])
  const [carregando, setCarregando]         = useState(false)
  const [modalAluno, setModalAluno]         = useState(null)
  const [relTipo, setRelTipo]               = useState("descritiva")
  const [palavrasChave, setPalavrasChave]   = useState("")
  const [relTexto, setRelTexto]             = useState("")
  const [relExiste, setRelExiste]           = useState(false)
  const [gerando, setGerando]               = useState(false)
  const [escola, setEscola]                 = useState("")
  const [escolaInput, setEscolaInput]       = useState("")
  const [editandoEscola, setEditandoEscola] = useState(false)
  const [apagandoTodos, setApagandoTodos]   = useState(false)
  const [todasNotasModal, setTodasNotasModal] = useState({})
  const [modalListaPDF, setModalListaPDF]   = useState(false)
  const [listaFormacao, setListaFormacao]   = useState("tecnica")

  useEffect(() => {
    getDoc(doc(db,"config","professor")).then(d => {
      if (d.exists() && d.data().escola) { setEscola(d.data().escola); setEscolaInput(d.data().escola) }
    })
  }, [])

  useEffect(() => {
    const q = query(collection(db,"alunos"), where("turmaId","==",turma.id))
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({id:d.id,...d.data()}))
      lista.sort((a,b) => a.nome.localeCompare(b.nome))
      setAlunos(lista)
    })
  }, [turma.id])

  useEffect(() => {
    localStorage.setItem(`bimestre_${turma.id}`, bimestre)
  }, [bimestre, turma.id])

  useEffect(() => {
    const q = query(collection(db,"notas"), where("turmaId","==",turma.id), where("trimestre","==",bimestre))
    return onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.data().alunoId] = {...d.data(), docId:d.id} })
      setNotas(map)
    })
  }, [turma.id, bimestre])

  const getVal = (alunoId, campo) => {
    const k = alunoId+"_"+campo
    return local[k] !== undefined ? local[k] : (notas[alunoId]?.[campo] ?? "")
  }

  const onChange = (alunoId, campo, val) => setLocal(prev => ({...prev,[alunoId+"_"+campo]:val}))

  const onBlur = async (alunoId, campo, val) => {
    setLocal(prev => { const n={...prev}; delete n[alunoId+"_"+campo]; return n })
    if (campo==="obs") { await updateDoc(doc(db,"alunos",alunoId), {obs:val}); return }
    if (val!=="" && (Number(val)<0 || Number(val)>10)) return
    const atual = notas[alunoId] || {}
    if (atual.docId) {
      await updateDoc(doc(db,"notas",atual.docId), {[campo]:val})
    } else {
      await addDoc(collection(db,"notas"), {alunoId, turmaId:turma.id, trimestre:bimestre, atividades:"", participacao:"", comportamento:"", [campo]:val})
    }
  }

  const addAluno = async () => {
    if (!nome.trim()) return
    await addDoc(collection(db,"alunos"), {nome:nome.trim(), turmaId:turma.id, obs:""})
    setNome("")
  }

  const delAluno = async (id) => {
    if (confirm("Remover esse aluno?")) await deleteDoc(doc(db,"alunos",id))
  }

  const limparTurmaToda = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso apagará TODOS os alunos, notas e relatórios desta turma. Tem certeza absoluta?")) return;
    if (!confirm("🔴 Última chance: deseja realmente continuar? Esta ação é irreversível!")) return;
    setApagandoTodos(true);
    try {
      const qAlunos = query(collection(db, "alunos"), where("turmaId", "==", turma.id));
      const snapAlunos = await getDocs(qAlunos);
      const qNotas = query(collection(db, "notas"), where("turmaId", "==", turma.id));
      const snapNotas = await getDocs(qNotas);
      const qRelatorios = query(collection(db, "relatorios"), where("turmaId", "==", turma.id));
      const snapRelatorios = await getDocs(qRelatorios);
      const promessas = [];
      snapAlunos.docs.forEach(d => promessas.push(deleteDoc(doc(db, "alunos", d.id))));
      snapNotas.docs.forEach(d => promessas.push(deleteDoc(doc(db, "notas", d.id))));
      snapRelatorios.docs.forEach(d => promessas.push(deleteDoc(doc(db, "relatorios", d.id))));
      await Promise.all(promessas);
      alert("✅ Turma limpa com sucesso!");
    } catch (err) {
      alert("❌ Erro ao limpar a turma: " + err.message);
    }
    setApagandoTodos(false);
  };

  const salvarEscola = async () => {
    await setDoc(doc(db,"config","professor"), {escola:escolaInput}, {merge:true})
    setEscola(escolaInput); setEditandoEscola(false)
  }

  const abrirRelatorio = async (aluno) => {
    setModalAluno(aluno); setPalavrasChave(""); setRelTexto(""); setRelExiste(false); setRelTipo("descritiva"); setTodasNotasModal({})
    const q = query(collection(db,"relatorios"), where("alunoId","==",aluno.id), where("bimestre","==",bimestre), where("tipo","==","descritiva"))
    const snap = await getDocs(q)
    if (!snap.empty) { setRelTexto(snap.docs[0].data().texto); setRelExiste(true) }
  }

  const gerarRelatorio = async () => {
    setGerando(true)
    const notasAtuais = notas[modalAluno.id] || {}
    const temNotasAtuais = notasAtuais.atividades !== "" || notasAtuais.participacao !== "" || notasAtuais.comportamento !== ""

    const todasNotas = {}
    for (const b of BIMESTRES) {
      if (b === bimestre) {
        if (temNotasAtuais) todasNotas[b] = notasAtuais
      } else {
        const snap = await getDocs(query(collection(db,"notas"), where("alunoId","==",modalAluno.id), where("trimestre","==",b)))
        if (!snap.empty) {
          const d = snap.docs[0].data()
          if (d.atividades!=="" || d.participacao!=="" || d.comportamento!=="") todasNotas[b] = d
        }
      }
    }

    const cred = credenciais(turma.tipo)
    const dataHoje = new Date().toLocaleDateString("pt-BR")
    const escolaTexto = escola ? "Escola: "+escola+"." : ""
    const notasTexto = Object.entries(todasNotas).map(([b,n]) => 
      b+": Atividades="+(n.atividades||"-")+", Participação="+(n.participacao||"-")+", Comportamento="+(n.comportamento||"-")
    ).join(" | ")

    const palavras = palavrasChave.trim() || "Nenhuma palavra-chave fornecida"
    const obs = modalAluno.obs || "nenhuma"

    let prompt = `Escreva uma avaliação descritiva escolar para o aluno ${modalAluno.nome} (turma ${turma.nome}, disciplina ${turma.disciplina}). ${escolaTexto}

**INSTRUÇÕES OBRIGATÓRIAS:**
1. O relatório deve ser construído **exclusivamente** a partir das seguintes palavras-chave fornecidas pelo professor:
   "${palavras}"
2. **NÃO INVENTE** nenhuma informação que não esteja nessas palavras-chave.
3. Se as palavras-chave descrevem dificuldades, o relatório deve abordá-las de forma clara e objetiva.
4. Se as palavras-chave descrevem qualidades, destaque-as.
5. Mencione as notas do aluno por bimestre de forma objetiva no relatório, citando os valores registrados.
6. Escreva em **linguagem simples, clara e direta**, em um único parágrafo.
7. **NÃO** use títulos, asteriscos, markdown ou listas.
8. **NÃO** invente assinaturas ou datas – elas serão adicionadas automaticamente.

Informações adicionais (apenas para contexto):
- Notas (todos os bimestres com dados): ${notasTexto || "Nenhuma nota registrada."}
- Observação do professor: ${obs}

Agora, escreva o relatório.`

    if (relTipo === "indisciplina") {
      prompt = `Escreva uma avaliação descritiva de indisciplina escolar, com tom pedagógico e não punitivo, para o aluno ${modalAluno.nome}. ${prompt}`
    }

    try {
      // CORREÇÃO APLICADA AQUI: Enviando os dados encapsulados em "message"
      const resp = await fetch("/api/chat", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ message: prompt }) 
      })
      const json = await resp.json()
      
      if (!resp.ok) {
        throw new Error(json.error?.message || json.error || 'Erro interno da API');
      }

      const textoRaw = json.content?.find(b=>b.type==="text")?.text || "Erro ao gerar."
      const texto = limparMarkdown(textoRaw)
      
      await addDoc(collection(db,"relatorios"), {
        alunoId:modalAluno.id,
        alunoNome:modalAluno.nome,
        turmaId:turma.id,
        bimestre,
        texto,
        palavrasChave: palavras,
        tipo:relTipo,
        criadoEm:new Date().toISOString()
      })
      setTodasNotasModal(todasNotas)
      setRelTexto(texto); setRelExiste(true)
    } catch(err) { alert("Erro: "+err.message) }
    setGerando(false)
  }

  const copiarTexto = () => { navigator.clipboard.writeText(relTexto); alert("Copiado!") }

  const whatsappTexto = () => window.open("https://wa.me/?text="+encodeURIComponent(relTexto),"_blank")

  const gerarPDFBlob = () => {
    const pdf = new jsPDF()
    const dataHoje = new Date().toLocaleDateString("pt-BR")
    const cred = credenciais(turma.tipo)
    let curY = 14

    if (escola) {
      pdf.setFontSize(11); pdf.setFont("helvetica","bold"); pdf.setTextColor(0,0,0)
      pdf.text(escola.toUpperCase(), 105, curY, { align:"center" })
      curY += 10
    }

    pdf.setFillColor(232,84,10); pdf.rect(0,curY,210,30,"F")
    pdf.setTextColor(255,255,255); pdf.setFontSize(13); pdf.setFont("helvetica","bold")
    pdf.text("Avaliação Descritiva"+(relTipo==="indisciplina"?" — Indisciplina":""), 105, curY+10, {align:"center"})
    pdf.setFontSize(9); pdf.setFont("helvetica","normal")
    pdf.text("Aluno: "+modalAluno.nome+"  |  Turma: "+turma.nome+"  |  "+turma.disciplina, 105, curY+19, {align:"center"})
    pdf.text(bimestre+"  |  "+dataHoje, 105, curY+26, {align:"center"})
    curY += 36

    const notasRows = Object.entries(todasNotasModal).length > 0
      ? Object.entries(todasNotasModal).map(([b,n]) => [b, n.atividades||"—", n.participacao||"—", n.comportamento||"—"])
      : [[bimestre, notas[modalAluno.id]?.atividades||"—", notas[modalAluno.id]?.participacao||"—", notas[modalAluno.id]?.comportamento||"—"]]
    autoTable(pdf, {
      startY: curY,
      head: [["Bimestre","Atividades","Participação","Comportamento"]],
      body: notasRows,
      styles: { fontSize:8, cellPadding:2, halign:"center" },
      headStyles: { fillColor:[232,84,10], textColor:255, fontStyle:"bold", halign:"center" },
      margin: { left:14, right:14 }, tableWidth:"wrap"
    })
    curY = pdf.lastAutoTable.finalY + 8

    pdf.setFontSize(11); pdf.setFont("helvetica","normal"); pdf.setTextColor(0,0,0)
    const lines = pdf.splitTextToSize(relTexto, 182)
    pdf.text(lines, 14, curY)
    curY += lines.length * 6 + 12

    pdf.setFontSize(9); pdf.setFont("helvetica","italic"); pdf.setTextColor(80,80,80)
    pdf.text("Prof. Thiago Fernando — "+cred, 14, curY)

    return pdf
  }

  const exportarRelatorioPDF = () => {
    gerarPDFBlob().save("AvaliacaoDescritiva_"+modalAluno.nome.replace(/ /g,"_")+"_"+bimestre+".pdf")
  }

  const whatsappPDF = () => {
    exportarRelatorioPDF()
    setTimeout(() => {
      const msg = "Avaliação Descritiva de "+modalAluno.nome+" ("+turma.nome+" — "+bimestre+") gerada. Segue o PDF em anexo."
      window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank")
    }, 800)
  }

  const exportarPDF = () => {
    const pdf = new jsPDF("landscape")
    pdf.setFillColor(232,84,10); pdf.rect(0,0,297,28,"F")
    pdf.setTextColor(255,255,255); pdf.setFontSize(16); pdf.setFont("helvetica","bold")
    pdf.text("Diário do Professor",14,12)
    pdf.setFontSize(9); pdf.setFont("helvetica","normal")
    pdf.text("Turma: "+turma.nome+"  |  "+turma.disciplina+(escola?"  |  "+escola:""),14,20)
    pdf.text(bimestre+"  |  Gerado em: "+new Date().toLocaleDateString("pt-BR"),14,26)
    pdf.setTextColor(0,0,0)
    autoTable(pdf,{startY:32,head:[["#","Aluno","Atividades","Participação","Comportamento","Observação"]],body:alunos.map((a,i)=>[String(i+1).padStart(2,"00"),a.nome,notas[a.id]?.atividades??"",notas[a.id]?.participacao??"",notas[a.id]?.comportamento??"",a.obs||""]),styles:{fontSize:9,cellPadding:4},headStyles:{fillColor:[232,84,10],textColor:255,fontStyle:"bold"},alternateRowStyles:{fillColor:[249,250,251]}})
    pdf.save(turma.nome+"_"+bimestre+".pdf"); setMenu(false)
  }

  const exportarExcel = () => {
    const ws = XLSX.utils.json_to_sheet(alunos.map((a,i)=>({"#":String(i+1).padStart(2,"00"),"Aluno":a.nome,"Atividades":notas[a.id]?.atividades??"","Participação":notas[a.id]?.participacao??"","Comportamento":notas[a.id]?.comportamento??"","Observação":a.obs||""})))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb,ws,bimestre)
    XLSX.writeFile(wb,turma.nome+"_"+bimestre+".xlsx"); setMenu(false)
  }

  const gerarListaAbnt = () => {
    const pdf = new jsPDF("landscape","mm","a4")
    const dataHoje = new Date().toLocaleDateString("pt-BR")
    const cred = listaFormacao === "tecnica"
      ? "Graduando em Engenharia de Computação, Licenciado em Matemática"
      : "Licenciado em História, Pós-graduado em Metodologia de Ensino"
    let curY = 12
    if (escola) {
      pdf.setFontSize(11); pdf.setFont("helvetica","bold"); pdf.setTextColor(0,0,0)
      pdf.text(escola.toUpperCase(), 148.5, curY, {align:"center"})
      curY += 7
    }
    pdf.setFontSize(10); pdf.setFont("helvetica","bold"); pdf.setTextColor(0,0,0)
    pdf.text("DIÁRIO DE CLASSE — "+bimestre.toUpperCase(), 148.5, curY, {align:"center"})
    curY += 5
    pdf.setFontSize(9); pdf.setFont("helvetica","normal")
    pdf.text("Turma: "+turma.nome+"  |  Disciplina: "+turma.disciplina+"  |  Data: "+dataHoje, 148.5, curY, {align:"center"})
    curY += 4
    pdf.setDrawColor(232,84,10); pdf.setLineWidth(0.5)
    pdf.line(14, curY, 283, curY)
    curY += 4
    autoTable(pdf, {
      startY: curY,
      head: [["#","Nome do Aluno","Atividades","Participação","Comportamento","Observação"]],
      body: alunos.map((a,i) => [
        String(i+1).padStart(2,"0"), a.nome,
        notas[a.id]?.atividades ?? "—",
        notas[a.id]?.participacao ?? "—",
        notas[a.id]?.comportamento ?? "—",
        a.obs || ""
      ]),
      styles: {fontSize:8.5, cellPadding:2},
      headStyles: {fillColor:[232,84,10],textColor:255,fontStyle:"bold",halign:"center",fontSize:8.5},
      columnStyles: {
        0:{halign:"center",cellWidth:10},
        1:{cellWidth:85},
        2:{halign:"center",cellWidth:25},
        3:{halign:"center",cellWidth:25},
        4:{halign:"center",cellWidth:25},
        5:{cellWidth:"auto"}
      },
      alternateRowStyles:{fillColor:[249,250,251]},
      margin:{left:14,right:14}
    })
    const totalPags = pdf.internal.getNumberOfPages()
    for (let i = 1; i <= totalPags; i++) {
      pdf.setPage(i)
      pdf.setFontSize(7); pdf.setTextColor(150,150,150)
      pdf.text("Página "+i+" / "+totalPags, 283-14, 204, {align:"right"})
    }
    pdf.setPage(totalPags)
    curY = pdf.lastAutoTable.finalY + 10
    if (curY > 190) { pdf.addPage("landscape"); curY = 14 }
    pdf.setFontSize(9); pdf.setFont("helvetica","normal"); pdf.setTextColor(0,0,0)
    pdf.setDrawColor(0,0,0); pdf.setLineWidth(0.3)
    pdf.line(14, curY, 80, curY)
    pdf.text("Prof. Thiago Fernando", 14, curY+4)
    pdf.text(cred, 14, curY+9)
    pdf.text("Data: "+dataHoje, 14, curY+14)
    return pdf
  }

  const compartilharListaPDF = () => {
    const pdf = gerarListaAbnt()
    pdf.save("Lista_"+turma.nome+"_"+bimestre.replace(/ /g,"_")+".pdf")
    setModalListaPDF(false)
  }

  const whatsappListaPDF = () => {
    const pdf = gerarListaAbnt()
    pdf.save("Lista_"+turma.nome+"_"+bimestre.replace(/ /g,"_")+".pdf")
    setTimeout(() => {
      const msg = "Lista de notas — "+turma.nome+" ("+turma.disciplina+") — "+bimestre
      window.open("https://wa.me/?text="+encodeURIComponent(msg),"_blank")
    }, 900)
    setModalListaPDF(false)
  }

  const extrairNomesExcel = (rows) => {
    let headerRowIndex = -1;
    let nomeColIndex = -1;
    
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i];
      if (!Array.isArray(row)) continue;
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').toLowerCase().trim();
        if (['nome', 'aluno', 'estudante', 'nome do aluno', 'aluno(a)'].includes(cell)) {
          headerRowIndex = i;
          nomeColIndex = j;
          break;
        }
      }
      if (headerRowIndex !== -1) break;
    }

    const nomes = [];
    if (headerRowIndex !== -1 && nomeColIndex !== -1) {
      for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!Array.isArray(row) || row.length <= nomeColIndex) continue;
        const val = String(row[nomeColIndex] || '').trim();
        if (val.length > 2 && /[a-zA-ZÀ-ÿ]/.test(val)) {
          const nomeLimpo = val.replace(/[^\w\sÀ-ÿ]/g, '').replace(/\s+/g, ' ').trim();
          if (nomeLimpo && !/^\d+$/.test(nomeLimpo)) {
            nomes.push(nomeLimpo);
          }
        }
      }
    } else {
      const palavrasIgnorar = ['turma', 'data', 'professor', 'disciplina', 'escola', 'ano', 'bimestre', 'matrícula', 'ra', 'nº', 'numero', 'nota', 'atividade', 'participação', 'comportamento', 'obs', 'observação'];
      for (const row of rows) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
          if (typeof cell !== 'string') continue;
          const limpo = cell.trim();
          if (limpo.length < 3) continue;
          const lower = limpo.toLowerCase();
          if (palavrasIgnorar.some(p => lower.includes(p))) continue;
          if (/[a-zA-ZÀ-ÿ]{3,}/.test(limpo) && !/^\d+$/.test(limpo)) {
            const nomeLimpo = limpo.replace(/[^\w\sÀ-ÿ]/g, '').replace(/\s+/g, ' ').trim();
            if (nomeLimpo && nomeLimpo.split(' ').length >= 2) {
              nomes.push(nomeLimpo);
            }
          }
        }
      }
    }
    return Array.from(new Set(nomes));
  };

  const handleArquivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCarregando(true);
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        const nomesExtraidos = extrairNomesExcel(rows);
        if (nomesExtraidos.length > 0) {
          setNomesEditados(nomesExtraidos);
        } else {
          alert('Nenhum nome de aluno foi encontrado na planilha. Verifique se o arquivo possui uma coluna com os nomes.');
        }
      } catch (err) {
        alert('Erro ao ler arquivo Excel: ' + err.message);
      }
      setCarregando(false);
      return;
    }

    if (ext === 'pdf') {
      try {
        const base64 = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result.split(',')[1]);
          r.onerror = () => rej(new Error('Falha ao ler o arquivo PDF.'));
          r.readAsDataURL(file);
        });

        // CORREÇÃO APLICADA AQUI TAMBÉM: Usando a propriedade "message" para conversar com o backend
        const resp = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
              { type: 'text', text: 'Extraia apenas os nomes completos dos alunos. Retorne SOMENTE os nomes, um por linha. IGNORE qualquer outra informação como: números de matrícula, turma, disciplina, data, cabeçalhos, rodapés, notas, assinaturas, etc. Se houver mais de um nome na mesma linha, separe em linhas diferentes. Não adicione numeração, pontuação ou textos extras. Apenas os nomes.' },
            ]
          }),
        });

        const data = await resp.json();
        if (data.error) {
          throw new Error(data.error.message || data.error || 'Erro retornado pela API da Anthropic');
        }

        const texto = data.content?.find((b) => b.type === 'text')?.text || '';
        const lista = texto.split(/\r?\n/).map((n) => n.trim()).filter((n) => n.length > 2 && /[a-zA-ZÀ-ÿ]/.test(n));

        if (lista.length > 0) {
          const unicos = Array.from(new Set(lista));
          const nomesFiltrados = unicos.filter(n => n.split(' ').length >= 2);
          setNomesEditados(nomesFiltrados.length > 0 ? nomesFiltrados : unicos);
        } else {
          alert('A IA não conseguiu identificar nomes no PDF fornecido.');
        }
      } catch (err) {
        alert('Erro na extração do PDF: ' + err.message);
      }
      setCarregando(false);
      return;
    }

    alert('Formato não suportado. Por favor, envie um arquivo .pdf, .xlsx, .xls ou .csv.');
    setCarregando(false);
  };

  const confirmarImport = async () => {
    for (const n of nomesEditados.filter(n=>n.trim().length>2)) await addDoc(collection(db,"alunos"),{nome:n.trim(),turmaId:turma.id,obs:""})
    setNomesEditados([]); setImportando(false)
  }

  const btnMenu = {width:"100%",padding:"0.75rem 1rem",textAlign:"left",background:"none",border:"none",cursor:"pointer",color:"var(--text)",fontSize:"0.9rem",borderBottom:"1px solid var(--border)"}
  const overlay = {position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}
  const modal   = {background:"var(--bg-card)",borderRadius:"16px",padding:"1.5rem",maxWidth:"520px",width:"100%",maxHeight:"88vh",overflowY:"auto"}

  return (
    <div style={{paddingTop:"1rem"}}>
      <div style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",width:"100%"}}>
        <select value={bimestre} onChange={e=>setBimestre(e.target.value)} className="input-modern" style={{flex:"1",minWidth:"120px",maxWidth:"200px",fontWeight:"600",cursor:"pointer"}}>
          {BIMESTRES.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
        <div style={{position:"relative"}}>
          <button className="btn-primary" onClick={()=>setMenu(!menu)} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>☰ Ações</button>
          {menu && (
            <div style={{position:"absolute",top:"110%",left:0,background:"var(--bg-card)",border:"1px solid var(--border)",borderRadius:"10px",boxShadow:"0 4px 16px rgba(0,0,0,0.15)",zIndex:100,minWidth:"210px",overflow:"hidden"}}>
              <button style={btnMenu} onClick={exportarPDF}>📄 Exportar PDF</button>
              <button style={btnMenu} onClick={exportarExcel}>📊 Exportar Excel</button>
              <button style={btnMenu} onClick={()=>{setImportando(true);setMenu(false)}}>📥 Importar Lista (PDF / Excel)</button>
              <button style={btnMenu} onClick={()=>{setEditandoEscola(true);setMenu(false)}}>🏫 {escola||"Definir Escola"}</button>
              <button style={{...btnMenu,borderBottom:"none"}} onClick={()=>{setModalListaPDF(true);setMenu(false)}}>📤 Compartilhar Lista — {bimestre}</button>
            </div>
          )}
        </div>
        <button 
          onClick={limparTurmaToda} 
          disabled={alunos.length === 0 || apagandoTodos}
          style={{
            background: alunos.length === 0 || apagandoTodos ? "#a0a0a0" : "#DC2626",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "0.6rem 1.2rem",
            cursor: alunos.length === 0 || apagandoTodos ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            whiteSpace: "nowrap",
            transition: "0.2s"
          }}
        >
          {apagandoTodos ? "⏳ Apagando..." : "🗑️ Apagar Todos"}
        </button>
      </div>

      {editandoEscola && (
        <div style={overlay}>
          <div style={{...modal,maxWidth:"400px"}}>
            <h3 style={{fontWeight:"700",marginBottom:"1rem",color:"var(--text)"}}>🏫 Nome da Escola</h3>
            <input className="input-modern" value={escolaInput} onChange={e=>setEscolaInput(e.target.value)} placeholder="Ex: E.E. Prof. Simão Mathias" onKeyDown={e=>e.key==="Enter"&&salvarEscola()} style={{marginBottom:"0.75rem"}} />
            <p style={{fontSize:"0.8rem",color:"var(--text-muted)",marginBottom:"1rem"}}>Salvo uma vez, aparece em todas as Avaliações Descritivas.</p>
            <div style={{display:"flex",gap:"0.5rem"}}>
              <button className="btn-primary" onClick={salvarEscola} style={{flex:1}}>Salvar</button>
              <button className="btn-ghost" onClick={()=>setEditandoEscola(false)} style={{flex:1}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {modalListaPDF && (
        <div style={overlay}>
          <div style={{...modal,maxWidth:"420px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <h3 style={{fontWeight:"700",color:"var(--text)"}}>📤 Compartilhar Lista</h3>
              <button onClick={()=>setModalListaPDF(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:"1.2rem"}}>✕</button>
            </div>
            <div style={{background:"var(--bg)",borderRadius:"8px",padding:"0.75rem",marginBottom:"1rem",fontSize:"0.85rem"}}>
              <p><strong style={{color:"var(--text)"}}>{turma.nome}</strong> — {turma.disciplina}</p>
              {escola && <p style={{marginTop:"0.25rem",color:"var(--text-muted)"}}>{escola}</p>}
              <p style={{marginTop:"0.25rem",color:"var(--text-muted)"}}>{alunos.length} alunos | {bimestre}</p>
            </div>
            <p style={{fontSize:"0.85rem",fontWeight:"600",color:"var(--text)",marginBottom:"0.5rem"}}>Área de formação:</p>
            <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.25rem"}}>
              <button onClick={()=>setListaFormacao("tecnica")} style={{flex:1,padding:"0.6rem",borderRadius:"8px",border:"2px solid",borderColor:listaFormacao==="tecnica"?"var(--accent)":"var(--border)",background:listaFormacao==="tecnica"?"var(--accent-light)":"transparent",color:listaFormacao==="tecnica"?"var(--accent)":"var(--text-muted)",fontWeight:"600",cursor:"pointer",fontSize:"0.8rem"}}>
                💻 Tecnológica
              </button>
              <button onClick={()=>setListaFormacao("humanas")} style={{flex:1,padding:"0.6rem",borderRadius:"8px",border:"2px solid",borderColor:listaFormacao==="humanas"?"var(--accent)":"var(--border)",background:listaFormacao==="humanas"?"var(--accent-light)":"transparent",color:listaFormacao==="humanas"?"var(--accent)":"var(--text-muted)",fontWeight:"600",cursor:"pointer",fontSize:"0.8rem"}}>
                📚 Humanas
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.5rem"}}>
              <button className="btn-primary" onClick={compartilharListaPDF} style={{fontSize:"0.85rem"}}>📄 Baixar PDF</button>
              <button onClick={whatsappListaPDF} style={{background:"#128C7E",color:"white",border:"none",borderRadius:"8px",padding:"0.6rem",cursor:"pointer",fontSize:"0.85rem",fontWeight:"600"}}>📱 WhatsApp + PDF</button>
            </div>
            <button className="btn-ghost" onClick={()=>setModalListaPDF(false)} style={{width:"100%",fontSize:"0.85rem"}}>Cancelar</button>
          </div>
        </div>
      )}

      {importando && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{fontWeight:"700",marginBottom:"0.5rem",color:"var(--text)"}}>📥 Importar Lista de Alunos</h3>
            <p style={{fontSize:"0.85rem",color:"var(--text-muted)",marginBottom:"1rem"}}>Envie o PDF da Plataforma do Futuro ou sua Planilha Excel (.xlsx, .xls, .csv). Os nomes serão extraídos para sua revisão.</p>
            <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleArquivo} style={{width:"100%",marginBottom:"1rem",color:"var(--text)"}} />
            {carregando && <p style={{color:"var(--accent)",fontWeight:"600",marginBottom:"1rem"}}>⏳ Extraindo nomes com IA...</p>}
            {nomesEditados.length>0 && (
              <div>
                <p style={{fontWeight:"600",marginBottom:"0.5rem",color:"var(--text)"}}>{nomesEditados.length} alunos encontrados — edite se necessário:</p>
                <div style={{maxHeight:"200px",overflowY:"auto",border:"1px solid var(--border)",borderRadius:"8px",padding:"0.5rem",marginBottom:"1rem",display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                  {nomesEditados.map((n,i)=>(
                    <div key={i} style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
                      <span style={{color:"var(--text-muted)",fontSize:"0.75rem",minWidth:"1.5rem"}}>{String(i+1).padStart(2,"0")}.</span>
                      <input value={n} onChange={e=>{const arr=[...nomesEditados];arr[i]=e.target.value;setNomesEditados(arr)}} style={{flex:1,fontSize:"0.9rem",padding:"0.2rem 0.5rem",border:"1px solid var(--border)",borderRadius:"6px",background:"var(--bg)",color:"var(--text)"}} />
                      <button onClick={()=>setNomesEditados(prev=>prev.filter((_,j)=>j!==i))} style={{color:"#DC2626",background:"none",border:"none",cursor:"pointer"}}>✕</button>
                    </div>
                  ))}
                </div>
                <button className="btn-primary" onClick={confirmarImport} style={{width:"100%",marginBottom:"0.5rem"}}>✓ Confirmar e Importar {nomesEditados.filter(n=>n.trim().length>2).length} alunos</button>
              </div>
            )}
            <button className="btn-ghost" onClick={()=>{setImportando(false);setNomesEditados([])}} style={{width:"100%"}}>Cancelar</button>
          </div>
        </div>
      )}

      {modalAluno && (
        <div style={overlay}>
          <div style={modal}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"1rem"}}>
              <div>
                <h3 style={{fontWeight:"700",color:"var(--text)"}}>Avaliação Descritiva</h3>
                <p style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>{modalAluno.nome} | {turma.nome} | {bimestre}</p>
              </div>
              <button onClick={()=>{setModalAluno(null);setRelTexto("")}} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:"1.2rem"}}>✕</button>
            </div>
            {!relExiste && (
              <div style={{marginBottom:"1rem"}}>
                <div style={{display:"flex",gap:"0.5rem",marginBottom:"1rem"}}>
                  <button onClick={()=>setRelTipo("descritiva")} className={relTipo==="descritiva"?"btn-primary":"btn-ghost"} style={{flex:1,fontSize:"0.85rem"}}>📝 Padrão</button>
                  <button onClick={()=>setRelTipo("indisciplina")} style={{flex:1,fontSize:"0.85rem",border:"none",borderRadius:"8px",padding:"0.6rem",cursor:"pointer",fontWeight:"600",background:relTipo==="indisciplina"?"#DC2626":"transparent",color:relTipo==="indisciplina"?"white":"#DC2626",border:relTipo==="indisciplina"?"none":"1px solid #DC2626"}}>⚠️ Indisciplina</button>
                </div>
                <label style={{fontSize:"0.85rem",fontWeight:"600",color:"var(--text)",display:"block",marginBottom:"0.4rem"}}>
                  Palavras-chave / referências:
                  <span style={{fontWeight:"400",color:"var(--text-muted)",fontSize:"0.8rem"}}> (obrigatório – o relatório será escrito com base nelas)</span>
                </label>
                <textarea 
                  value={palavrasChave} 
                  onChange={e=>setPalavrasChave(e.target.value)}
                  placeholder={relTipo==="indisciplina" 
                    ? "Ex: saída de sala, desrespeito, agressão verbal, não segue regras, etc." 
                    : "Ex: dedicado, participativo, atento, bom desempenho, dificuldade em matemática, etc."}
                  style={{width:"100%",minHeight:"80px",padding:"0.6rem",border:"1px solid var(--border)",borderRadius:"8px",fontSize:"0.9rem",background:"var(--bg)",color:"var(--text)",resize:"vertical"}} 
                />
                <p style={{fontSize:"0.75rem",color:"var(--text-muted)",marginTop:"0.25rem",fontStyle:"italic"}}>
                  ⚠️ O relatório será gerado <strong>estritamente</strong> com base nas palavras-chave fornecidas.
                </p>
                <button className="btn-primary" onClick={gerarRelatorio} disabled={gerando}
                  style={{width:"100%",marginTop:"0.75rem",background:relTipo==="indisciplina"?"#DC2626":undefined}}>
                  {gerando ? "⏳ Gerando..." : "Gerar Avaliação Descritiva"}
                </button>
              </div>
            )}
            {relTexto && (
              <div>
                {relExiste && <p style={{fontSize:"0.75rem",color:"#16A34A",fontWeight:"600",marginBottom:"0.75rem"}}>✓ Salvo no banco — não será repetido neste bimestre</p>}
                <div style={{background:"var(--bg)",border:"1px solid var(--border)",borderRadius:"8px",padding:"1rem",marginBottom:"1rem",fontSize:"0.9rem",color:"var(--text)",lineHeight:"1.8",whiteSpace:"pre-wrap"}}>{relTexto}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
                  <button className="btn-primary" onClick={exportarRelatorioPDF} style={{fontSize:"0.8rem"}}>📄 Baixar PDF</button>
                  <button className="btn-ghost" onClick={copiarTexto} style={{fontSize:"0.8rem"}}>📋 Copiar Texto</button>
                  <button onClick={whatsappTexto} style={{background:"#25D366",color:"white",border:"none",borderRadius:"8px",padding:"0.6rem",cursor:"pointer",fontSize:"0.8rem",fontWeight:"600"}}>💬 WhatsApp Texto</button>
                  <button onClick={whatsappPDF} style={{background:"#128C7E",color:"white",border:"none",borderRadius:"8px",padding:"0.6rem",cursor:"pointer",fontSize:"0.8rem",fontWeight:"600"}}>📱 WhatsApp + PDF</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card" style={{overflowX:"auto",marginBottom:"1rem"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:"0.9rem"}}>
          <thead className="thead-sticky">
            <tr>
              <th style={{padding:"0.75rem 0.5rem",textAlign:"left",color:"var(--text-muted)",fontWeight:"600",fontSize:"0.75rem",textTransform:"uppercase"}}>#</th>
              <th style={{padding:"0.75rem 0.5rem",textAlign:"left",color:"var(--text-muted)",fontWeight:"600",fontSize:"0.75rem",textTransform:"uppercase",minWidth:"10rem"}}>Aluno</th>
              {LABELS.map(l=><th key={l} style={{padding:"0.75rem 0.5rem",textAlign:"center",color:"var(--text-muted)",fontWeight:"600",fontSize:"0.75rem",textTransform:"uppercase",minWidth:"5.5rem"}}>{l}</th>)}
              <th style={{padding:"0.75rem 0.5rem",textAlign:"left",color:"var(--text-muted)",fontWeight:"600",fontSize:"0.75rem",textTransform:"uppercase",minWidth:"8rem"}}>Observação</th>
              <th style={{padding:"0.75rem 0.5rem",width:"5rem"}}></th>
            </tr>
          </thead>
          <tbody>
            {alunos.length===0 && <tr><td colSpan="8" style={{padding:"2rem",textAlign:"center",color:"var(--text-muted)",fontStyle:"italic"}}>Nenhum aluno registrado</td></tr>}
            {alunos.map((a,i)=>(
              <tr key={a.id} style={{borderBottom:"1px solid var(--border)"}}>
                <td style={{padding:"0.5rem",color:"var(--text-muted)",fontSize:"0.8rem",textAlign:"center"}}>{String(i+1).padStart(2,"00")}</td>
                <td style={{padding:"0.5rem",color:"var(--text)",fontWeight:"500"}}>{a.nome}</td>
                {CRITERIOS.map(c=>{const val=getVal(a.id,c);return <td key={c} style={{padding:"0.3rem",textAlign:"center"}}><input type="number" min="0" max="10" step="0.5" value={val} onChange={e=>onChange(a.id,c,e.target.value)} onBlur={e=>onBlur(a.id,c,e.target.value)} className={"nota-input "+corNota(val)} /></td>})}
                <td style={{padding:"0.3rem"}}><input type="text" defaultValue={a.obs||""} onBlur={e=>onBlur(a.id,"obs",e.target.value)} placeholder="Ex: transferido..." className="obs-input" /></td>
                <td style={{padding:"0.3rem",textAlign:"center",whiteSpace:"nowrap"}}>
                  <button onClick={()=>abrirRelatorio(a)} title="Avaliação Descritiva" style={{background:"none",border:"none",cursor:"pointer",fontSize:"1rem",marginRight:"0.25rem"}}>📝</button>
                  <button onClick={()=>delAluno(a.id)} style={{color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",fontSize:"1rem"}}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
        <input className="input-modern" value={nome} onChange={e=>setNome(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addAluno()} placeholder="Nome do aluno — Enter para registrar" style={{flex:1,minWidth:"200px"}} />
        <button className="btn-primary" onClick={addAluno} style={{whiteSpace:"nowrap",minWidth:"7rem"}}>+ Registrar</button>
      </div>
    </div>
  )
}