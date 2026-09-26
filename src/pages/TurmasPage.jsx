import { useState, useEffect, useRef } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore"
import { useAviso } from "../lib/avisos"

const CORES_FBG = ["#E8540A","#D97706","#16A34A","#DC2626","#059669","#B45309"]
const CORES_FTP = ["#2563EB","#9333EA","#0891B2","#7C3AED","#1D4ED8","#6D28D9"]
const COR_CADERNO = "#7C3AED"

// Segredo compartilhado com as rotas de IA (/api/chat), mesmo padrão já usado
// no restante do app (PlanilhaPage.jsx).
const AI_HEADERS = { "Content-Type": "application/json", "x-api-secret": import.meta.env.VITE_API_SECRET || "" }

export default function TurmasPage({ onSelectTurma }) {
  const { mostrarToast, confirmar } = useAviso()
  const [turmas, setTurmas] = useState([])
  const [nome, setNome] = useState("")
  const [disciplina, setDisciplina] = useState("")
  const [tipo, setTipo] = useState("basica")
  const [form, setForm] = useState(false)
  const [formNota, setFormNota] = useState(false)
  // Lembra a última aba usada (FBG/FTP/Caderno) entre acessos, só neste navegador.
  const [aba, setAbaState] = useState(() => localStorage.getItem("ultimaAba") || "basica") // "basica" | "tecnica" | "caderno"
  const setAba = (novaAba) => {
    setAbaState(novaAba)
    localStorage.setItem("ultimaAba", novaAba)
  }

  // Contagem de alunos por turma, só pra mostrar nos cards — não altera nada
  // na coleção "alunos", é apenas uma leitura pra exibir "N alunos".
  const [contagemAlunos, setContagemAlunos] = useState({})

  // Caderno de notas soltas: coleção própria ("caderno"), sem nenhuma relação
  // com alunos/notas/turmas/relatorios — lembretes rápidos do dia a dia que
  // o professor pode apagar quando quiser. Cada nota fica salva no Firestore
  // com título e conteúdo, e o título pode ser editado depois.
  const [notas, setNotas] = useState([])
  const [novoTitulo, setNovoTitulo] = useState("")
  const [novaNota, setNovaNota] = useState("")
  const [editandoId, setEditandoId] = useState(null)
  const [tituloEdit, setTituloEdit] = useState("")
  const [textoEdit, setTextoEdit] = useState("")
  const [copiadoId, setCopiadoId] = useState(null)

  // Nota por áudio: grava com o reconhecimento de voz do navegador e manda o
  // texto bruto pra IA (mesma usada no resto do app) só pra corrigir erros de
  // transcrição — não inventa conteúdo novo.
  const [gravando, setGravando] = useState(false)
  const [processandoAudio, setProcessandoAudio] = useState(false)
  const [transcricaoAoVivo, setTranscricaoAoVivo] = useState("")
  const reconhecimentoRef = useRef(null)

  useEffect(() => {
    return onSnapshot(collection(db,"turmas"), snap => {
      setTurmas(snap.docs.map(d => ({id:d.id,...d.data()})))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db,"alunos"), snap => {
      const contagem = {}
      snap.docs.forEach(d => {
        const turmaId = d.data().turmaId
        if (turmaId) contagem[turmaId] = (contagem[turmaId] || 0) + 1
      })
      setContagemAlunos(contagem)
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db,"caderno"), snap => {
      const lista = snap.docs.map(d => ({id:d.id,...d.data()}))
      lista.sort((a,b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
      setNotas(lista)
    })
  }, [])

  const adicionar = async () => {
    if (!nome.trim() || !disciplina.trim()) return
    await addDoc(collection(db,"turmas"), {nome, disciplina, tipo})
    setNome(""); setDisciplina(""); setTipo("basica"); setForm(false)
    setAba(tipo) // muda para a aba da turma recém criada
  }

  const remover = async (e, id) => {
    e.stopPropagation()
    if (await confirmar("Essa turma será removida. Isso não afeta os alunos/notas já registrados nela.", { titulo: "Remover turma?" })) {
      await deleteDoc(doc(db,"turmas",id))
    }
  }

  const adicionarNota = async () => {
    if (!novaNota.trim()) return
    await addDoc(collection(db,"caderno"), {
      titulo: novoTitulo.trim() || "Sem título",
      texto: novaNota.trim(),
      criadoEm: serverTimestamp(),
    })
    setNovoTitulo(""); setNovaNota(""); setFormNota(false)
  }

  const removerNota = async (id) => {
    if (await confirmar("Essa anotação será apagada e não pode ser recuperada.", { titulo: "Apagar nota?" })) {
      await deleteDoc(doc(db,"caderno",id))
    }
  }

  // Manda a transcrição bruta (com erros típicos de reconhecimento de voz)
  // pra IA só corrigir pontuação/erros, sem inventar informação nova.
  const corrigirTranscricao = async (bruto) => {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: AI_HEADERS,
      body: JSON.stringify({
        prompt: `Corrija apenas erros de transcrição de voz (pontuação, acentuação, palavras mal reconhecidas) no texto abaixo, em português do Brasil. Não adicione informação nova, não resuma, não explique nada — devolva só o texto corrigido.\n\nTranscrição bruta:\n"""${bruto}"""`,
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
      }),
    })
    const data = await resp.json()
    if (data.error) throw new Error(data.error)
    return (data.texto || bruto).trim()
  }

  const MENSAGENS_ERRO_AUDIO = {
    "not-allowed": "Permissão de microfone negada. Clique no cadeado ao lado do endereço do site, libere o microfone e tente de novo.",
    "audio-capture": "Nenhum microfone encontrado. Verifique se há um microfone conectado e tente de novo.",
    "network": "Falha de rede no reconhecimento de voz. Verifique sua conexão com a internet.",
    "no-speech": "Não consegui ouvir nada. Fale mais perto do microfone e tente de novo.",
    "service-not-allowed": "O navegador bloqueou o serviço de reconhecimento de voz.",
  }

  const alternarGravacao = async () => {
    if (gravando) {
      reconhecimentoRef.current?.stop()
      return
    }
    const Reconhecimento = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Reconhecimento) {
      mostrarToast("erro", "Seu navegador não suporta gravação de voz. Tente pelo Google Chrome.")
      return
    }

    // Pede a permissão do microfone de forma explícita ANTES de iniciar o
    // reconhecimento de voz. Sem isso, quando a permissão está negada, o
    // reconhecimento falha em silêncio (parece que "não acontece nada").
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop())
    } catch {
      mostrarToast("erro", MENSAGENS_ERRO_AUDIO["not-allowed"])
      return
    }

    const rec = new Reconhecimento()
    rec.lang = "pt-BR"
    // continuous=false: o próprio Chrome detecta quando você parou de falar e
    // encerra sozinho (não precisa clicar em "parar"). interimResults=true dá
    // o texto aparecendo ao vivo enquanto você fala, como retorno visual.
    rec.continuous = false
    rec.interimResults = true

    let transcricaoFinal = ""
    rec.onresult = (e) => {
      let interina = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) transcricaoFinal += e.results[i][0].transcript + " "
        else interina += e.results[i][0].transcript
      }
      setTranscricaoAoVivo(interina)
    }
    rec.onerror = (e) => {
      if (e.error === "aborted") return // veio de clicar em "Parar gravação" — não é erro
      mostrarToast("erro", MENSAGENS_ERRO_AUDIO[e.error] || ("Não foi possível gravar o áudio: " + e.error))
    }
    rec.onend = async () => {
      setGravando(false)
      setTranscricaoAoVivo("")
      const bruto = transcricaoFinal.trim()
      if (!bruto) return
      setProcessandoAudio(true)
      try {
        const corrigido = await corrigirTranscricao(bruto)
        setNovaNota(atual => atual ? `${atual} ${corrigido}` : corrigido)
        mostrarToast("sucesso", "Áudio transcrito e corrigido pela IA.")
      } catch {
        // Se a IA falhar (ex.: chave expirada), ainda aproveita a transcrição crua
        setNovaNota(atual => atual ? `${atual} ${bruto}` : bruto)
        mostrarToast("info", "Não consegui corrigir o áudio com a IA, mas salvei a transcrição bruta no campo.")
      }
      setProcessandoAudio(false)
    }

    reconhecimentoRef.current = rec
    setGravando(true)
    rec.start()
  }

  const iniciarEdicaoNota = (n) => {
    setEditandoId(n.id)
    setTituloEdit(n.titulo || "")
    setTextoEdit(n.texto || "")
  }

  const salvarNota = async (id) => {
    if (!textoEdit.trim()) { mostrarToast("erro", "O conteúdo da anotação não pode ficar vazio."); return }
    await updateDoc(doc(db,"caderno",id), { titulo: tituloEdit.trim() || "Sem título", texto: textoEdit.trim() })
    setEditandoId(null)
  }

  const marcarCopiado = (id) => {
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(atual => atual === id ? null : atual), 1500)
  }

  // Tenta a Clipboard API (funciona na maioria dos navegadores modernos em
  // HTTPS/localhost); se o navegador bloquear (ex.: contexto sem permissão),
  // cai automaticamente no método antigo via textarea + execCommand, que
  // funciona em praticamente qualquer navegador.
  const copiarNota = async (n) => {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error("clipboard indisponível")
      await navigator.clipboard.writeText(n.texto)
      marcarCopiado(n.id)
      return
    } catch {
      // segue pro fallback abaixo
    }
    const area = document.createElement("textarea")
    area.value = n.texto
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.focus(); area.select()
    let copiou = false
    try { copiou = document.execCommand("copy") } catch { copiou = false }
    document.body.removeChild(area)
    if (copiou) marcarCopiado(n.id)
    else mostrarToast("erro", "Não foi possível copiar automaticamente. Selecione o texto manualmente.")
  }

  const fbg = turmas.filter(t => t.tipo !== "tecnica")
  const ftp = turmas.filter(t => t.tipo === "tecnica")
  const lista = aba === "basica" ? fbg : ftp
  const cores = aba === "basica" ? CORES_FBG : CORES_FTP
  const cor_aba = aba === "basica" ? "var(--accent)" : "#2563EB"
  const totalAlunos = Object.values(contagemAlunos).reduce((soma, n) => soma + n, 0)

  return (
    <div style={{paddingTop:"1rem"}}>
      <style>{`
        @keyframes piscarGravacao { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
      `}</style>

      {/* Hero */}
      <div className="hero-card" style={{marginBottom:"1.5rem"}}>
        <span className="badge">📋 Portal do Professor</span>
        <h1 style={{fontSize:"clamp(1.5rem,5vw,2rem)",fontWeight:"800",margin:"0.75rem 0 0.5rem",color:"var(--text)"}}>
          Prof. Thiago Fernando
        </h1>
        <p style={{color:"var(--text-muted)",fontSize:"0.95rem",fontStyle:"italic"}}>
          "A historia explica de onde viemos; a tecnologia programa o seu futuro."
        </p>
        <div style={{display:"flex",gap:"0.5rem",marginTop:"0.9rem",flexWrap:"wrap"}}>
          <span style={{display:"flex",alignItems:"center",gap:"0.35rem",background:"rgba(255,255,255,0.55)",
            border:"1px solid rgba(0,0,0,0.06)",color:"var(--text)",fontWeight:"700",fontSize:"0.8rem",
            padding:"0.3rem 0.7rem",borderRadius:"999px"}}>
            🏫 {turmas.length} turma{turmas.length===1?"":"s"}
          </span>
          <span style={{display:"flex",alignItems:"center",gap:"0.35rem",background:"rgba(255,255,255,0.55)",
            border:"1px solid rgba(0,0,0,0.06)",color:"var(--text)",fontWeight:"700",fontSize:"0.8rem",
            padding:"0.3rem 0.7rem",borderRadius:"999px"}}>
            👤 {totalAlunos} aluno{totalAlunos===1?"":"s"}
          </span>
          {notas.length > 0 && (
            <span style={{display:"flex",alignItems:"center",gap:"0.35rem",background:"rgba(255,255,255,0.55)",
              border:"1px solid rgba(0,0,0,0.06)",color:"var(--text)",fontWeight:"700",fontSize:"0.8rem",
              padding:"0.3rem 0.7rem",borderRadius:"999px"}}>
              📝 {notas.length} nota{notas.length===1?"":"s"}
            </span>
          )}
        </div>
      </div>

      {/* Cabeçalho + botão + */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.75rem"}}>
        <div>
          <h2 style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>Painel de Turmas</h2>
          <p style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>Selecione uma turma para lançar as avaliações</p>
        </div>
        <button onClick={() => aba === "caderno" ? setFormNota(!formNota) : setForm(!form)}
          title={aba === "caderno" ? "Nova Nota" : "Nova Turma"}
          style={{width:"48px",height:"48px",borderRadius:"50%",
            background: aba === "caderno" ? COR_CADERNO : "var(--accent)", color:"white",
            border:"none",fontSize:"1.6rem",cursor:"pointer",display:"flex",alignItems:"center",
            justifyContent:"center",
            boxShadow: aba === "caderno" ? "0 4px 12px rgba(124,58,237,0.4)" : "0 4px 12px rgba(232,84,10,0.4)",
            flexShrink:0}}>+</button>
      </div>

      {/* Abas FBG / FTP / Caderno */}
      <div className="abas-turma" style={{display:"flex",gap:"0.5rem",marginBottom:"1.5rem"}}>
        <button onClick={()=>setAba("basica")} style={{
          flex:1, padding:"0.6rem 0.5rem", borderRadius:"10px", cursor:"pointer",
          fontWeight:"700", fontSize:"0.9rem", transition:"all 0.15s",
          background: aba==="basica" ? "var(--accent)" : "var(--bg-card)",
          color: aba==="basica" ? "white" : "var(--text-muted)",
          boxShadow: aba==="basica" ? "0 2px 8px rgba(232,84,10,0.35)" : "none",
          border: aba==="basica" ? "none" : "1px solid var(--border)"
        }}>
          🟠 FBG — Básica ({fbg.length})
        </button>
        <button onClick={()=>setAba("tecnica")} style={{
          flex:1, padding:"0.6rem 0.5rem", borderRadius:"10px", cursor:"pointer",
          fontWeight:"700", fontSize:"0.9rem", transition:"all 0.15s",
          background: aba==="tecnica" ? "#2563EB" : "var(--bg-card)",
          color: aba==="tecnica" ? "white" : "var(--text-muted)",
          boxShadow: aba==="tecnica" ? "0 2px 8px rgba(37,99,235,0.35)" : "none",
          border: aba==="tecnica" ? "none" : "1px solid var(--border)"
        }}>
          🔵 FTP — Técnica ({ftp.length})
        </button>
        <button onClick={()=>setAba("caderno")} style={{
          flex:1, padding:"0.6rem 0.5rem", borderRadius:"10px", cursor:"pointer",
          fontWeight:"700", fontSize:"0.9rem", transition:"all 0.15s",
          background: aba==="caderno" ? COR_CADERNO : "var(--bg-card)",
          color: aba==="caderno" ? "white" : "var(--text-muted)",
          boxShadow: aba==="caderno" ? "0 2px 8px rgba(124,58,237,0.35)" : "none",
          border: aba==="caderno" ? "none" : "1px solid var(--border)"
        }}>
          📝 Caderno ({notas.length})
        </button>
      </div>

      {/* Form nova turma */}
      {form && aba !== "caderno" && (
        <div className="card" style={{padding:"1rem",marginBottom:"1.25rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <h3 style={{fontWeight:"600",color:"var(--text)"}}>Registrar Nova Turma</h3>
          <input className="input-modern" value={nome} onChange={e=>setNome(e.target.value)} placeholder="Nome da turma (ex: 1G)" />
          <input className="input-modern" value={disciplina} onChange={e=>setDisciplina(e.target.value)} placeholder="Disciplina (ex: História)" />
          <select className="input-modern" value={tipo} onChange={e=>setTipo(e.target.value)}>
            <option value="basica">🟠 Formação Básica — História, etc.</option>
            <option value="tecnica">🔵 Formação Técnica — Software, Competências, etc.</option>
          </select>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button className="btn-primary" onClick={adicionar}>Registrar</button>
            <button className="btn-ghost" onClick={()=>setForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Caderno de notas soltas */}
      {aba === "caderno" ? (
        <div style={{display:"flex",flexDirection:"column",gap:"1rem"}}>
          {formNota && (
            <div className="card" style={{padding:"1rem",display:"flex",flexDirection:"column",gap:"0.6rem"}}>
              <input className="input-modern" value={novoTitulo} onChange={e=>setNovoTitulo(e.target.value)}
                placeholder="Título da anotação (opcional)" autoFocus />
              <textarea className="input-modern" value={novaNota} onChange={e=>setNovaNota(e.target.value)}
                placeholder="Escreva aqui um lembrete rápido..." rows={3}
                style={{resize:"vertical",fontFamily:"inherit"}} />
              <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                <button onClick={alternarGravacao} disabled={processandoAudio}
                  style={{alignSelf:"flex-start",display:"flex",alignItems:"center",gap:"0.4rem",
                    background: gravando ? "#DC2626" : "none",
                    color: gravando ? "white" : COR_CADERNO,
                    border:`1px solid ${gravando ? "#DC2626" : COR_CADERNO}`,
                    borderRadius:"999px",padding:"0.35rem 0.8rem",fontSize:"0.8rem",fontWeight:"700",
                    cursor: processandoAudio ? "wait" : "pointer"}}>
                  {gravando && (
                    <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"white",
                      animation:"piscarGravacao 1s ease-in-out infinite"}} />
                  )}
                  {processandoAudio ? "⏳ Corrigindo com IA..." : gravando ? "⏹ Parar gravação (ouvindo...)" : "🎤 Gravar nota por áudio"}
                </button>
                {gravando && (
                  <p style={{fontSize:"0.8rem",color:"var(--text-muted)",fontStyle:"italic",minHeight:"1.2em"}}>
                    {transcricaoAoVivo || "Pode falar..."}
                  </p>
                )}
              </div>
              <div style={{display:"flex",gap:"0.5rem"}}>
                <button className="btn-primary" onClick={adicionarNota}>+ Adicionar nota</button>
                <button className="btn-ghost" onClick={()=>setFormNota(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {notas.length === 0 && !formNota ? (
            <div style={{textAlign:"center",padding:"2.5rem 1rem",color:"var(--text-muted)"}}>
              <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>📝</div>
              <p style={{fontStyle:"italic"}}>Nenhuma anotação ainda.</p>
              <p style={{fontSize:"0.8rem",marginTop:"0.4rem"}}>Clique em + para adicionar.</p>
            </div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
              {notas.map(n => (
                <div key={n.id} className="card" style={{
                  padding:"0.85rem 1rem", borderRadius:"12px",
                  borderLeft:`3px solid ${COR_CADERNO}`, display:"flex", flexDirection:"column", gap:"0.4rem"
                }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"0.5rem"}}>
                    {editandoId === n.id ? (
                      <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",flex:1}}>
                        <input className="input-modern" value={tituloEdit} autoFocus
                          onChange={e=>setTituloEdit(e.target.value)}
                          placeholder="Título da anotação"
                          style={{padding:"0.35rem 0.6rem",fontSize:"0.9rem"}} />
                        <textarea className="input-modern" value={textoEdit}
                          onChange={e=>setTextoEdit(e.target.value)}
                          placeholder="Conteúdo da anotação"
                          rows={3} style={{resize:"vertical",fontFamily:"inherit",fontSize:"0.9rem",padding:"0.5rem 0.6rem"}} />
                        <div style={{display:"flex",gap:"0.4rem"}}>
                          <button className="btn-primary" style={{padding:"0.3rem 0.7rem",fontSize:"0.8rem"}}
                            onClick={()=>salvarNota(n.id)}>Salvar</button>
                          <button className="btn-ghost" style={{padding:"0.3rem 0.7rem",fontSize:"0.8rem"}}
                            onClick={()=>setEditandoId(null)}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <p style={{fontWeight:"700",fontSize:"0.95rem",color:"var(--text)"}}>
                        {n.titulo || "Sem título"}
                      </p>
                    )}
                    <div style={{display:"flex",gap:"0.3rem",flexShrink:0}}>
                      {editandoId !== n.id && (
                        <button onClick={()=>iniciarEdicaoNota(n)} title="Editar anotação"
                          style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:"0.85rem"}}>✎</button>
                      )}
                      <button onClick={()=>removerNota(n.id)} title="Apagar"
                        style={{background:"none",border:"none",cursor:"pointer",color:"var(--text-muted)",fontSize:"0.85rem"}}>✕</button>
                    </div>
                  </div>
                  {editandoId !== n.id && (
                    <p style={{fontSize:"0.9rem",color:"var(--text)",whiteSpace:"pre-wrap",lineHeight:1.4}}>
                      {n.texto}
                    </p>
                  )}
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:"0.7rem",color:"var(--text-muted)"}}>
                      {n.criadoEm?.toDate ? n.criadoEm.toDate().toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"}) : ""}
                    </span>
                    {editandoId !== n.id && (
                      <button onClick={()=>copiarNota(n)}
                        style={{background:"none",border:"1px solid var(--border)",borderRadius:"6px",
                          padding:"0.25rem 0.6rem",cursor:"pointer",fontSize:"0.75rem",
                          color: copiadoId===n.id ? "#16A34A" : "var(--text-muted)",fontWeight:"600"}}>
                        {copiadoId===n.id ? "✓ Copiado" : "⧉ Copiar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : lista.length === 0 ? (
        <div style={{textAlign:"center",padding:"3rem 1rem",color:"var(--text-muted)"}}>
          <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>{aba==="basica"?"🟠":"🔵"}</div>
          <p style={{fontStyle:"italic"}}>
            {aba==="basica" ? "Nenhuma turma de Formação Básica." : "Nenhuma turma de Formação Técnica."}
          </p>
          <p style={{fontSize:"0.8rem",marginTop:"0.4rem"}}>Clique em + para adicionar.</p>
        </div>
      ) : (
        <div className="turmas-grid" style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))",
          gap:"1rem"
        }}>
          {lista.map((t, i) => {
            const cor = cores[i % cores.length]
            const iniciais = t.nome.replace(/\s/g,"").slice(0,2).toUpperCase()
            const qtdAlunos = contagemAlunos[t.id] || 0
            return (
              <div key={t.id} onClick={()=>onSelectTurma(t)}
                style={{
                  display:"flex", flexDirection:"column", alignItems:"center",
                  gap:"0.55rem", padding:"1.1rem 0.6rem 0", borderRadius:"16px",
                  background:`linear-gradient(160deg, ${cor}1a, var(--bg-card) 60%)`,
                  border:`1px solid ${cor}33`, borderTop:`3px solid ${cor}`,
                  cursor:"pointer", position:"relative", overflow:"hidden",
                  transition:"box-shadow 0.2s, transform 0.15s",
                  boxShadow:"var(--shadow)"
                }}
                onMouseEnter={e=>{
                  e.currentTarget.style.boxShadow=`0 8px 24px ${cor}45`
                  e.currentTarget.style.transform="translateY(-3px)"
                  const btnRemover = e.currentTarget.querySelector(".card-remove-btn")
                  if (btnRemover) btnRemover.style.opacity = "1"
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.boxShadow="var(--shadow)"
                  e.currentTarget.style.transform="translateY(0)"
                  const btnRemover = e.currentTarget.querySelector(".card-remove-btn")
                  if (btnRemover) btnRemover.style.opacity = "0.35"
                }}>

                {/* Botão remover — discreto, destaca só ao passar o mouse no card */}
                <button onClick={e=>remover(e,t.id)} className="card-remove-btn"
                  style={{position:"absolute",top:"6px",right:"8px",background:"none",border:"none",
                    cursor:"pointer",color:"var(--text-muted)",fontSize:"0.85rem",lineHeight:1,padding:"2px",
                    opacity:"0.35",transition:"opacity 0.15s"}}>✕</button>

                {/* Selo com nº de alunos */}
                <span style={{
                  position:"absolute", top:"8px", left:"10px", fontSize:"0.65rem", fontWeight:"700",
                  color:cor, background:`${cor}1f`, borderRadius:"999px", padding:"0.15rem 0.5rem"
                }}>
                  👤 {qtdAlunos}
                </span>

                {/* Círculo com iniciais */}
                <div style={{
                  width:"72px", height:"72px", borderRadius:"50%",
                  background:`linear-gradient(135deg, ${cor}dd, ${cor})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"white", fontWeight:"900", fontSize:"1.35rem",
                  boxShadow:`0 4px 12px ${cor}55`, letterSpacing:"0.02em", flexShrink:0, marginTop:"0.3rem"
                }}>
                  {iniciais}
                </div>

                {/* Nome e disciplina */}
                <div style={{textAlign:"center",width:"100%",padding:"0 0.25rem"}}>
                  <p style={{fontWeight:"800",fontSize:"1.05rem",color:"var(--text)",lineHeight:1.2}}>
                    {t.nome}
                  </p>
                  <span style={{display:"inline-block",fontSize:"0.65rem",fontWeight:"700",color:cor,
                    background:`${cor}14`,borderRadius:"999px",padding:"0.1rem 0.55rem",marginTop:"0.35rem",
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>
                    {t.disciplina}
                  </span>
                </div>

                {/* Ver planilha — faixa de destaque no rodapé do card */}
                <span style={{
                  width:"calc(100% + 1.2rem)", marginTop:"0.3rem", padding:"0.45rem 0",
                  fontSize:"0.72rem", color:"white", fontWeight:"700", textAlign:"center",
                  background:`linear-gradient(90deg, ${cor}, ${cor}cc)`
                }}>
                  Ver planilha →
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
