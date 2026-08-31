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
  // --- Todos os estados originais ---
  const [bimestre, setBimestre]             = useState("1 Bimestre")
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

  // --- Dark mode detection (sincronizado com a classe .dark no html) ---
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const checkDark = () => {
      const isDark = document.documentElement.classList.contains('dark')
      setDarkMode(isDark)
    }
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // --- Efeitos originais (carregar escola, alunos, notas) ---
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
    const q = query(collection(db,"notas"), where("turmaId","==",turma.id), where("trimestre","==",bimestre))
    return onSnapshot(q, snap => {
      const map = {}
      snap.docs.forEach(d => { map[d.data().alunoId] = {...d.data(), docId:d.id} })
      setNotas(map)
    })
  }, [turma.id, bimestre])

  // --- Funções originais (todas mantidas) ---
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

  const salvarEscola = async () => {
    await setDoc(doc(db,"config","professor"), {escola:escolaInput}, {merge:true})
    setEscola(escolaInput); setEditandoEscola(false)
  }

  const abrirRelatorio = async (aluno) => {
    setModalAluno(aluno); setPalavrasChave(""); setRelTexto(""); setRelExiste(false); setRelTipo("descritiva")
    const q = query(collection(db,"relatorios"), where("alunoId","==",aluno.id), where("bimestre","==",bimestre), where("tipo","==","descritiva"))
    const snap = await getDocs(q)
    if (!snap.empty) { setRelTexto(snap.docs[0].data().texto); setRelExiste(true) }
  }

  const gerarRelatorio = async () => {
    setGerando(true)
    const todasNotas = {}
    for (const b of BIMESTRES) {
      const snap = await getDocs(query(collection(db,"notas"), where("alunoId","==",modalAluno.id), where("trimestre","==",b)))
      if (!snap.empty) {
        const d = snap.docs[0].data()
        if (d.atividades!=="" || d.participacao!=="" || d.comportamento!=="") todasNotas[b] = d
      }
    }
    const temNotas = Object.keys(todasNotas).length > 0
    const cred = credenciais(turma.tipo)
    const dataHoje = new Date().toLocaleDateString("pt-BR")
    const escolaTexto = escola ? "Escola: "+escola+"." : ""
    const notasTexto = Object.entries(todasNotas).map(([b,n]) => b+": Atividades="+(n.atividades||"-")+", Participação="+(n.participacao||"-")+", Comportamento="+(n.comportamento||"-")).join(" | ")
    let prompt = ""
    if (relTipo==="indisciplina") {
      prompt = "Gere uma Avaliação Descritiva de Indisciplina escolar formal, pedagógica e não punitiva para o aluno "+modalAluno.nome+", turma "+turma.nome+", disciplina "+turma.disciplina+". "+escolaTexto+" Palavras-chave: "+(palavrasChave||"comportamento inadequado")+". "+(temNotas?"Notas: "+notasTexto+".":"")+" Obs: "+(modalAluno.obs||"nenhuma")+". Texto corrido sem títulos, sem asteriscos, sem markdown. Ao final: Prof. Thiago Fernando, "+cred+". Data: "+dataHoje+"."
    } else if (!temNotas) {
      prompt = "Gere breve Avaliação Descritiva para "+modalAluno.nome+", turma "+turma.nome+", disciplina "+turma.disciplina+". "+escolaTexto+" Sem notas, apenas nome e turma. Texto corrido, sem asteriscos, sem markdown. Assine: Prof. Thiago Fernando, "+cred+". Data: "+dataHoje+"."
    } else {
      prompt = "Gere uma Avaliação Descritiva escolar profissional e humanizada para "+modalAluno.nome+", turma "+turma.nome+", disciplina "+turma.disciplina+". "+escolaTexto+" Palavras-chave: "+(palavrasChave||"nenhuma")+". Notas (só bimestres com dados): "+notasTexto+". Obs: "+(modalAluno.obs||"nenhuma")+". Parágrafo único, sem títulos, sem asteriscos, sem markdown. Ao final: Prof. Thiago Fernando, "+cred+". Data: "+dataHoje+"."
    }
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":import.meta.env.VITE_ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-haiku-4-5-20251001",max_tokens:600,messages:[{role:"user",content:prompt}]})
      })
      const json = await resp.json()
      const textoRaw = json.content?.find(b=>b.type==="text")?.text || "Erro ao gerar."
      const texto = limparMarkdown(textoRaw)
      await addDoc(collection(db,"relatorios"), {alunoId:modalAluno.id,alunoNome:modalAluno.nome,turmaId:turma.id,bimestre,texto,palavrasChave,tipo:relTipo,criadoEm:new Date().toISOString()})
      setRelTexto(texto); setRelExiste(true)
    } catch(err) { alert("Erro: "+err.message) }
    setGerando(false)
  }

  const copiarTexto = () => { navigator.clipboard.writeText(relTexto); alert("Copiado!") }

  const whatsappTexto = () => window.open("https://wa.me/?text="+encodeURIComponent(relTexto),"_blank")

  const gerarPDFBlob = () => {
    const pdf = new jsPDF()
    pdf.setFillColor(232,84,10); pdf.rect(0,0,210,42,"F")
    pdf.setTextColor(255,255,255); pdf.setFontSize(16); pdf.setFont("helvetica","bold")
    pdf.text("Avaliação Descritiva"+(relTipo==="indisciplina"?" — Indisciplina":""),14,14)
    pdf.setFontSize(11); pdf.setFont("helvetica","normal")
    pdf.text(modalAluno.nome,14,24)
    pdf.text("Turma: "+turma.nome+" | "+turma.disciplina+" | "+bimestre,14,32)
    if (escola) { pdf.setFontSize(9); pdf.text(escola,14,39) }
    pdf.setTextColor(0,0,0); pdf.setFontSize(11)
    const lines = pdf.splitTextToSize(relTexto,182)
    pdf.text(lines,14,52)
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
        const nomesExtraidos = [];
        for (const row of rows) {
          if (!Array.isArray(row)) continue;
          for (const cell of row) {
            if (typeof cell === 'string') {
              const limpo = cell.trim();
              const lower = limpo.toLowerCase();
              if (['nome', 'aluno', 'estudante', 'nome do aluno', 'ra', 'nº', 'numero', 'turma'].includes(lower)) continue;
              if (limpo.length > 2 && /[a-zA-ZÀ-ÿ]/.test(limpo) && !/^\d+$/.test(limpo)) {
                nomesExtraidos.push(limpo);
              }
            }
          }
        }
        const unicos = Array.from(new Set(nomesExtraidos));
        if (unicos.length > 0) {
          setNomesEditados(unicos);
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
          r.onload = () => res(r.result.split(','))[1];
          r.onerror = () => rej(new Error('Falha ao ler o arquivo PDF.'));
          r.readAsDataURL(file);
        });

        const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
        if (!apiKey) {
          throw new Error('Chave da Anthropic (VITE_ANTHROPIC_API_KEY) não encontrada nas variáveis de ambiente.');
        }

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: 2000,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                  { type: 'text', text: 'Extraia apenas os nomes completos dos alunos. Retorne SOMENTE os nomes, um por linha, sem numeração e sem textos adicionais.' },
                ],
              },
            ],
          }),
        });

        const data = await resp.json();
        if (data.error) {
          throw new Error(data.error.message || 'Erro retornado pela API da Anthropic');
        }

        const texto = data.content?.find((b) => b.type === 'text')?.text || '';
        const lista = texto.split(/\r?\n/).map((n) => n.trim()).filter((n) => n.length > 2);

        if (lista.length > 0) {
          setNomesEditados(lista);
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

  // --- Estilos dinâmicos para dark mode (inline) ---
  const isDark = darkMode
  const bgClass = isDark ? 'bg-dark' : 'bg-light'
  const textClass = isDark ? 'text-light' : 'text-dark'

  // Estilos inline para os componentes
  const styles = {
    container: {
      paddingTop: '1rem',
      color: isDark ? '#e0dcd6' : '#1a1a1a',
      backgroundColor: isDark ? '#1a1a1a' : 'transparent'
    },
    accordionWrapper: {
      marginBottom: '1rem'
    },
    accordionButton: (isOpen) => ({
      width: '100%',
      padding: '0.75rem 1rem',
      background: isOpen ? (isDark ? '#3a3a3a' : '#e8e0d5') : (isDark ? '#2a2a2a' : '#f5efe8'),
      color: isDark ? '#f0ece6' : '#1a1a1a',
      border: isDark ? '1px solid #444' : '1px solid #d6c8b4',
      borderRadius: isOpen ? '10px 10px 0 0' : '10px',
      fontSize: '1rem',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontFamily: "'Playfair Display', serif",
      transition: '0.2s'
    }),
    accordionIcon: (isOpen) => ({
      fontSize: '1.2rem',
      transition: 'transform 0.3s',
      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)'
    }),
    accordionContent: (isOpen) => ({
      overflow: 'hidden',
      maxHeight: isOpen ? '500px' : '0',
      transition: 'max-height 0.3s ease',
      background: isDark ? '#2a2a2a' : '#fcf8f2',
      borderRadius: isOpen ? '0 0 10px 10px' : '10px',
      border: isOpen ? (isDark ? '1px solid #444' : '1px solid #d6c8b4') : 'none',
      borderTop: 'none',
      padding: isOpen ? '0.8rem 1rem' : '0 1rem'
    }),
    card: {
      background: isDark ? '#2a2a2a' : '#fcf8f2',
      borderRadius: '12px',
      padding: '0.8rem 0.5rem',
      boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.5)' : '0 4px 14px rgba(0,0,0,0.08)',
      border: isDark ? '1px solid #444' : '1px solid #d6c8b4',
      overflowX: 'auto',
      marginBottom: '1rem'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: "'Crimson Text', serif",
      fontSize: '0.9rem',
      minWidth: '650px'
    },
    th: {
      background: isDark ? '#3a3a3a' : '#d9c9b0',
      color: isDark ? '#f0ece6' : '#1a1a1a',
      padding: '0.6rem 0.5rem',
      textAlign: 'left',
      fontFamily: "'Playfair Display', serif",
      fontWeight: '700',
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      borderBottom: isDark ? '2px solid #555' : '2px solid #b8a68b'
    },
    td: {
      padding: '0.5rem 0.4rem',
      borderBottom: isDark ? '1px solid #3a3a3a' : '1px solid #e3d9cb',
      color: isDark ? '#e0dcd6' : '#1a1a1a'
    },
    inputNota: {
      width: '4.2rem',
      textAlign: 'center',
      fontFamily: "'Playfair Display', serif",
      fontSize: '1rem',
      fontWeight: '700',
      padding: '0.2rem 0.2rem',
      border: isDark ? '1px solid #555' : '1px solid #b8a68b',
      borderRadius: '4px',
      background: isDark ? '#333' : 'white',
      color: isDark ? '#e0dcd6' : '#1a1a1a'
    },
    inputNome: {
      flex: '1 1 180px',
      padding: '0.7rem 0.9rem',
      borderRadius: '8px',
      border: isDark ? '1px solid #555' : '1px solid #b8a68b',
      fontFamily: "'Crimson Text', serif",
      fontSize: '1rem',
      background: isDark ? '#333' : 'white',
      color: isDark ? '#e0dcd6' : '#1a1a1a',
      outline: 'none',
      minWidth: '150px'
    },
    btnPrimary: {
      padding: '0.7rem 1.5rem',
      borderRadius: '8px',
      border: 'none',
      background: isDark ? '#5a4a3a' : '#4a3728',
      color: 'white',
      fontWeight: '700',
      cursor: 'pointer',
      fontFamily: "'Crimson Text', serif",
      fontSize: '1rem',
      whiteSpace: 'nowrap',
      transition: '0.2s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    btnDanger: {
      padding: '0.7rem 1.5rem',
      borderRadius: '8px',
      border: 'none',
      background: isDark ? '#8b1a1a' : '#b22234',
      color: 'white',
      fontWeight: '700',
      cursor: 'pointer',
      fontFamily: "'Crimson Text', serif",
      fontSize: '1rem',
      transition: '0.2s',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      justifyContent: 'center',
      flex: '1 1 200px',
      maxWidth: '320px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
    },
    btnDangerDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    rowEven: {
      background: isDark ? '#222' : '#f5efe8'
    },
    rowOdd: {
      background: isDark ? 'transparent' : 'transparent'
    },
    emptyRow: {
      padding: '1.8rem',
      textAlign: 'center',
      color: isDark ? '#aaa' : '#3e2e1f',
      fontStyle: 'italic',
      fontSize: '1rem'
    },
    deleteIcon: {
      color: isDark ? '#cc4444' : '#b22234',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '1.2rem',
      padding: '0.2rem 0.5rem'
    },
    actionRow: {
      marginTop: '0.8rem',
      display: 'flex',
      gap: '0.6rem',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'flex-start'
    },
    actionGroup: {
      display: 'flex',
      gap: '0.6rem',
      flexWrap: 'wrap',
      alignItems: 'center',
      width: '100%'
    },
    fileInput: {
      display: 'none'
    },
    fileInputLabel: {
      padding: '0.7rem 1.5rem',
      borderRadius: '8px',
      border: isDark ? '1px solid #555' : '1px solid #b8a68b',
      background: isDark ? '#333' : '#fcf8f2',
      color: isDark ? '#e0dcd6' : '#1a1a1a',
      cursor: 'pointer',
      fontFamily: "'Crimson Text', serif",
      fontSize: '1rem',
      transition: '0.2s',
      display: 'inline-block'
    },
    inputConfig: {
      width: '100%',
      maxWidth: '300px',
      padding: '0.7rem 0.9rem',
      borderRadius: '8px',
      border: isDark ? '1px solid #555' : '1px solid #b8a68b',
      fontFamily: "'Crimson Text', serif",
      fontSize: '1rem',
      background: isDark ? '#333' : 'white',
      color: isDark ? '#e0dcd6' : '#1a1a1a',
      outline: 'none'
    },
    overlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      zIndex: 200,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    },
    modal: {
      background: isDark ? '#2a2a2a' : '#fcf8f2',
      borderRadius: '16px',
      padding: '1.5rem',
      maxWidth: '520px',
      width: '100%',
      maxHeight: '88vh',
      overflowY: 'auto',
      color: isDark ? '#e0dcd6' : '#1a1a1a'
    },
    menuDropdown: {
      position: 'absolute',
      top: '110%',
      left: 0,
      background: isDark ? '#2a2a2a' : '#fcf8f2',
      border: isDark ? '1px solid #444' : '1px solid #d6c8b4',
      borderRadius: '10px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      zIndex: 100,
      minWidth: '210px',
      overflow: 'hidden'
    }
  }

  // --- Estado do accordion principal ---
  const [accordionOpen, setAccordionOpen] = useState(true)

  return (
    <div style={styles.container}>
      {/* Accordion para selecionar bimestre */}
      <div style={styles.accordionWrapper}>
        <button 
          style={styles.accordionButton(accordionOpen)} 
          onClick={() => setAccordionOpen(!accordionOpen)}
        >
          <span>📚 {bimestre}</span>
          <span style={styles.accordionIcon(accordionOpen)}>▼</span>
        </button>
        <div style={styles.accordionContent(accordionOpen)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', padding: '0.3rem 0' }}>
            {BIMESTRES.map(b => (
              <button
                key={b}
                onClick={() => { setBimestre(b); setAccordionOpen(false) }}
                style={{
                  padding: '0.6rem 1rem',
                  background: b === bimestre ? (isDark ? '#5a4a3a' : '#4a3728') : 'transparent',
                  color: b === bimestre ? (isDark ? '#f0ece6' : '#fcf8f2') : (isDark ? '#ccc' : '#1a1a1a'),
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: "'Crimson Text', serif",
                  fontSize: '0.95rem',
                  fontWeight: b === bimestre ? '700' : '400',
                  transition: '0.15s'
                }}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Menu Ações (dropdown) */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button 
            className="btn-primary" 
            onClick={() => setMenu(!menu)} 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            ☰ Ações
          </button>
          {menu && (
            <div style={styles.menuDropdown}>
              <button 
                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a', fontSize: '0.9rem', borderBottom: isDark ? '1px solid #444' : '1px solid #d6c8b4' }}
                onClick={() => { exportarPDF(); setMenu(false) }}
              >
                📄 Exportar PDF
              </button>
              <button 
                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a', fontSize: '0.9rem', borderBottom: isDark ? '1px solid #444' : '1px solid #d6c8b4' }}
                onClick={() => { exportarExcel(); setMenu(false) }}
              >
                📊 Exportar Excel
              </button>
              <button 
                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a', fontSize: '0.9rem', borderBottom: isDark ? '1px solid #444' : '1px solid #d6c8b4' }}
                onClick={() => { setImportando(true); setMenu(false) }}
              >
                📥 Importar Lista (PDF / Excel)
              </button>
              <button 
                style={{ width: '100%', padding: '0.75rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a', fontSize: '0.9rem' }}
                onClick={() => { setEditandoEscola(true); setMenu(false) }}
              >
                🏫 {escola || 'Definir Escola'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modais (Editando Escola, Importando, Relatório) - mantidos exatamente iguais, apenas ajustando cores */}

      {editandoEscola && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ fontWeight: '700', marginBottom: '1rem', color: isDark ? '#f0ece6' : '#1a1a1a' }}>🏫 Nome da Escola</h3>
            <input 
              className="input-modern" 
              value={escolaInput} 
              onChange={e => setEscolaInput(e.target.value)} 
              placeholder="Ex: E.E. Prof. Simão Mathias" 
              onKeyDown={e => e.key === 'Enter' && salvarEscola()} 
              style={{ width: '100%', marginBottom: '0.75rem', padding: '0.6rem', borderRadius: '8px', border: isDark ? '1px solid #555' : '1px solid #b8a68b', background: isDark ? '#333' : 'white', color: isDark ? '#e0dcd6' : '#1a1a1a' }} 
            />
            <p style={{ fontSize: '0.8rem', color: isDark ? '#aaa' : '#6b5a4a', marginBottom: '1rem' }}>Salvo uma vez, aparece em todas as Avaliações Descritivas.</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" onClick={salvarEscola} style={{ flex: 1 }}>Salvar</button>
              <button className="btn-ghost" onClick={() => setEditandoEscola(false)} style={{ flex: 1, background: 'none', border: '1px solid #b8a68b', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {importando && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <h3 style={{ fontWeight: '700', marginBottom: '0.5rem', color: isDark ? '#f0ece6' : '#1a1a1a' }}>📥 Importar Lista de Alunos</h3>
            <p style={{ fontSize: '0.85rem', color: isDark ? '#aaa' : '#6b5a4a', marginBottom: '1rem' }}>Envie o PDF da Plataforma do Futuro ou sua Planilha Excel (.xlsx, .xls, .csv). Os nomes serão extraídos para sua revisão.</p>
            <input type="file" accept=".pdf,.xlsx,.xls,.csv" onChange={handleArquivo} style={{ width: '100%', marginBottom: '1rem', color: isDark ? '#e0dcd6' : '#1a1a1a' }} />
            {carregando && <p style={{ color: '#e8792e', fontWeight: '600', marginBottom: '1rem' }}>⏳ Extraindo nomes com IA...</p>}
            {nomesEditados.length > 0 && (
              <div>
                <p style={{ fontWeight: '600', marginBottom: '0.5rem', color: isDark ? '#f0ece6' : '#1a1a1a' }}>{nomesEditados.length} alunos encontrados — edite se necessário:</p>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: isDark ? '1px solid #444' : '1px solid #d6c8b4', borderRadius: '8px', padding: '0.5rem', marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {nomesEditados.map((n, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <span style={{ color: isDark ? '#aaa' : '#6b5a4a', fontSize: '0.75rem', minWidth: '1.5rem' }}>{String(i+1).padStart(2, '0')}.</span>
                      <input 
                        value={n} 
                        onChange={e => { const arr = [...nomesEditados]; arr[i] = e.target.value; setNomesEditados(arr) }} 
                        style={{ flex: 1, fontSize: '0.9rem', padding: '0.2rem 0.5rem', border: isDark ? '1px solid #555' : '1px solid #b8a68b', borderRadius: '6px', background: isDark ? '#333' : 'white', color: isDark ? '#e0dcd6' : '#1a1a1a' }} 
                      />
                      <button onClick={() => setNomesEditados(prev => prev.filter((_, j) => j !== i))} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
                <button className="btn-primary" onClick={confirmarImport} style={{ width: '100%', marginBottom: '0.5rem' }}>✓ Confirmar e Importar {nomesEditados.filter(n => n.trim().length > 2).length} alunos</button>
              </div>
            )}
            <button className="btn-ghost" onClick={() => { setImportando(false); setNomesEditados([]) }} style={{ width: '100%', background: 'none', border: '1px solid #b8a68b', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a' }}>Cancelar</button>
          </div>
        </div>
      )}

      {modalAluno && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontWeight: '700', color: isDark ? '#f0ece6' : '#1a1a1a' }}>Avaliação Descritiva</h3>
                <p style={{ fontSize: '0.8rem', color: isDark ? '#aaa' : '#6b5a4a' }}>{modalAluno.nome} | {turma.nome} | {bimestre}</p>
              </div>
              <button onClick={() => { setModalAluno(null); setRelTexto('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isDark ? '#aaa' : '#6b5a4a', fontSize: '1.2rem' }}>✕</button>
            </div>
            {!relExiste && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button onClick={() => setRelTipo('descritiva')} className={relTipo === 'descritiva' ? 'btn-primary' : 'btn-ghost'} style={{ flex: 1, fontSize: '0.85rem', ...(relTipo === 'descritiva' ? {} : { background: 'none', border: '1px solid #b8a68b', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a' }) }}>📝 Padrão</button>
                  <button 
                    onClick={() => setRelTipo('indisciplina')} 
                    style={{ 
                      flex: 1, 
                      fontSize: '0.85rem', 
                      border: 'none', 
                      borderRadius: '8px', 
                      padding: '0.6rem', 
                      cursor: 'pointer', 
                      fontWeight: '600',
                      background: relTipo === 'indisciplina' ? '#DC2626' : 'transparent',
                      color: relTipo === 'indisciplina' ? 'white' : '#DC2626',
                      border: relTipo === 'indisciplina' ? 'none' : '1px solid #DC2626'
                    }}
                  >
                    ⚠️ Indisciplina
                  </button>
                </div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: isDark ? '#f0ece6' : '#1a1a1a', display: 'block', marginBottom: '0.4rem' }}>Palavras-chave:</label>
                <textarea 
                  value={palavrasChave} 
                  onChange={e => setPalavrasChave(e.target.value)}
                  placeholder={relTipo === 'indisciplina' ? 'Ex: saída de sala, desrespeito, agressão verbal' : 'Ex: dedicado, participativo, atento'}
                  style={{ width: '100%', minHeight: '70px', padding: '0.6rem', border: isDark ? '1px solid #555' : '1px solid #b8a68b', borderRadius: '8px', fontSize: '0.9rem', background: isDark ? '#333' : 'white', color: isDark ? '#e0dcd6' : '#1a1a1a', resize: 'vertical' }} 
                />
                <button 
                  className="btn-primary" 
                  onClick={gerarRelatorio} 
                  disabled={gerando}
                  style={{ width: '100%', marginTop: '0.75rem', background: relTipo === 'indisciplina' ? '#DC2626' : undefined }}
                >
                  {gerando ? '⏳ Gerando...' : 'Gerar Avaliação Descritiva'}
                </button>
              </div>
            )}
            {relTexto && (
              <div>
                {relExiste && <p style={{ fontSize: '0.75rem', color: '#16A34A', fontWeight: '600', marginBottom: '0.75rem' }}>✓ Salvo no banco — não será repetido neste bimestre</p>}
                <div style={{ background: isDark ? '#1a1a1a' : '#f5efe8', border: isDark ? '1px solid #444' : '1px solid #d6c8b4', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', fontSize: '0.9rem', color: isDark ? '#e0dcd6' : '#1a1a1a', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{relTexto}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <button className="btn-primary" onClick={exportarRelatorioPDF} style={{ fontSize: '0.8rem' }}>📄 Baixar PDF</button>
                  <button className="btn-ghost" onClick={copiarTexto} style={{ fontSize: '0.8rem', background: 'none', border: '1px solid #b8a68b', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', color: isDark ? '#e0dcd6' : '#1a1a1a' }}>📋 Copiar Texto</button>
                  <button onClick={whatsappTexto} style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>💬 WhatsApp Texto</button>
                  <button onClick={whatsappPDF} style={{ background: '#128C7E', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>📱 WhatsApp + PDF</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabela de alunos e notas */}
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={{ ...styles.th, textAlign: 'left' }}>Aluno</th>
              {LABELS.map(l => <th key={l} style={{ ...styles.th, textAlign: 'center' }}>{l}</th>)}
              <th style={{ ...styles.th, textAlign: 'left' }}>Observação</th>
              <th style={{ ...styles.th, textAlign: 'center', width: '5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 && (
              <tr><td colSpan="8" style={styles.emptyRow}>Nenhum aluno registrado</td></tr>
            )}
            {alunos.map((a, i) => {
              const rowStyle = i % 2 === 0 ? styles.rowEven : styles.rowOdd
              return (
                <tr key={a.id} style={{ ...rowStyle, borderBottom: isDark ? '1px solid #3a3a3a' : '1px solid #e3d9cb' }}>
                  <td style={{ ...styles.td, textAlign: 'center', color: isDark ? '#aaa' : '#6b5a4a', fontSize: '0.8rem' }}>
                    {String(i+1).padStart(2, '00')}
                  </td>
                  <td style={{ ...styles.td, fontWeight: '500' }}>{a.nome}</td>
                  {CRITERIOS.map(c => {
                    const val = getVal(a.id, c)
                    return (
                      <td key={c} style={{ ...styles.td, textAlign: 'center' }}>
                        <input 
                          type="number" 
                          min="0" 
                          max="10" 
                          step="0.5" 
                          value={val} 
                          onChange={e => onChange(a.id, c, e.target.value)} 
                          onBlur={e => onBlur(a.id, c, e.target.value)} 
                          className={`nota-input ${corNota(val)}`} 
                          style={styles.inputNota} 
                        />
                      </td>
                    )
                  })}
                  <td style={styles.td}>
                    <input 
                      type="text" 
                      defaultValue={a.obs || ''} 
                      onBlur={e => onBlur(a.id, 'obs', e.target.value)} 
                      placeholder="Ex: transferido..." 
                      className="obs-input" 
                      style={{ width: '100%', padding: '0.3rem', border: isDark ? '1px solid #555' : '1px solid #b8a68b', borderRadius: '4px', background: isDark ? '#333' : 'white', color: isDark ? '#e0dcd6' : '#1a1a1a' }} 
                    />
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button 
                      onClick={() => abrirRelatorio(a)} 
                      title="Avaliação Descritiva" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', marginRight: '0.25rem', color: isDark ? '#e0dcd6' : '#1a1a1a' }}
                    >
                      📝
                    </button>
                    <button 
                      onClick={() => delAluno(a.id)} 
                      style={{ color: isDark ? '#cc4444' : '#b22234', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Adicionar aluno */}
      <div style={styles.actionRow}>
        <input 
          className="input-modern" 
          value={nome} 
          onChange={e => setNome(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && addAluno()} 
          placeholder="Nome do aluno — Enter para registrar" 
          style={styles.inputNome} 
        />
        <button className="btn-primary" onClick={addAluno} style={{ ...styles.btnPrimary, whiteSpace: 'nowrap', minWidth: '7rem' }}>
          + Registrar
        </button>
      </div>
    </div>
  )
}