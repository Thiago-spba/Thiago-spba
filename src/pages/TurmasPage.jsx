import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore"

const CORES_FBG = ["#E8540A","#D97706","#16A34A","#DC2626","#059669","#B45309"]
const CORES_FTP = ["#2563EB","#9333EA","#0891B2","#7C3AED","#1D4ED8","#6D28D9"]

export default function TurmasPage({ onSelectTurma }) {
  const [turmas, setTurmas] = useState([])
  const [nome, setNome] = useState("")
  const [disciplina, setDisciplina] = useState("")
  const [tipo, setTipo] = useState("basica")
  const [form, setForm] = useState(false)
  const [aba, setAba] = useState("todas")

  useEffect(() => {
    return onSnapshot(collection(db,"turmas"), snap => {
      setTurmas(snap.docs.map(d => ({id:d.id,...d.data()})))
    })
  }, [])

  const adicionar = async () => {
    if (!nome.trim() || !disciplina.trim()) return
    await addDoc(collection(db,"turmas"), {nome, disciplina, tipo})
    setNome(""); setDisciplina(""); setTipo("basica"); setForm(false)
  }

  const remover = async (e, id) => {
    e.stopPropagation()
    if (confirm("Remover essa turma?")) await deleteDoc(doc(db,"turmas",id))
  }

  const fbg = turmas.filter(t => t.tipo !== "tecnica")
  const ftp = turmas.filter(t => t.tipo === "tecnica")
  const lista = aba === "basica" ? fbg : aba === "tecnica" ? ftp : turmas

  const corCard = (t, i) =>
    t.tipo === "tecnica"
      ? CORES_FTP[ftp.indexOf(t) % CORES_FTP.length]
      : CORES_FBG[fbg.indexOf(t) % CORES_FBG.length]

  const tabStyle = (key) => ({
    padding: "0.45rem 1.1rem",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "700",
    fontSize: "0.85rem",
    transition: "all 0.15s",
    background: aba === key
      ? (key === "tecnica" ? "#2563EB" : key === "basica" ? "var(--accent)" : "var(--text)")
      : "var(--bg-card)",
    color: aba === key ? "white" : "var(--text-muted)",
    border: aba === key ? "none" : "1px solid var(--border)"
  })

  return (
    <div style={{paddingTop:"1rem"}}>
      <div className="hero-card" style={{marginBottom:"1.5rem"}}>
        <span className="badge">📋 Portal do Professor</span>
        <h1 style={{fontSize:"clamp(1.5rem,5vw,2rem)",fontWeight:"800",margin:"0.75rem 0 0.5rem",color:"var(--text)"}}>Prof. Thiago Fernando</h1>
        <p style={{color:"var(--text-muted)",fontSize:"0.95rem",fontStyle:"italic"}}>"A historia explica de onde viemos; a tecnologia programa o seu futuro."</p>
      </div>

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.75rem"}}>
        <div>
          <h2 style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>Painel de Turmas</h2>
          <p style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>Selecione uma turma para lançar as avaliações</p>
        </div>
        <button onClick={() => setForm(!form)} title="Nova Turma" style={{width:"48px",height:"48px",borderRadius:"50%",background:"var(--accent)",color:"white",border:"none",fontSize:"1.6rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(232,84,10,0.4)",flexShrink:0}}>+</button>
      </div>

      {/* Abas */}
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"1.25rem",flexWrap:"wrap"}}>
        <button style={tabStyle("todas")} onClick={()=>setAba("todas")}>
          Todas ({turmas.length})
        </button>
        <button style={tabStyle("basica")} onClick={()=>setAba("basica")}>
          🟠 FBG — Básica ({fbg.length})
        </button>
        <button style={tabStyle("tecnica")} onClick={()=>setAba("tecnica")}>
          🔵 FTP — Técnica ({ftp.length})
        </button>
      </div>

      {form && (
        <div className="card" style={{padding:"1rem",marginBottom:"1rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <h3 style={{fontWeight:"600",color:"var(--text)"}}>Registrar Nova Turma</h3>
          <input className="input-modern" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da turma (ex: 1G)" />
          <input className="input-modern" value={disciplina} onChange={e => setDisciplina(e.target.value)} placeholder="Disciplina (ex: História)" />
          <select className="input-modern" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="basica">🟠 Formação Básica — História, etc.</option>
            <option value="tecnica">🔵 Formação Técnica — Software, Competências, etc.</option>
          </select>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button className="btn-primary" onClick={adicionar}>Registrar</button>
            <button className="btn-ghost" onClick={() => setForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Seção FBG */}
      {(aba === "todas" || aba === "basica") && fbg.length > 0 && (
        <div style={{marginBottom:"1.5rem"}}>
          {aba === "todas" && (
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"var(--accent)",flexShrink:0}}/>
              <span style={{fontWeight:"700",fontSize:"0.9rem",color:"var(--accent)"}}>Formação Básica</span>
              <span style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>— {fbg.length} turma{fbg.length!==1?"s":""}</span>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"1rem"}}>
            {fbg.map((t,i) => (
              <div key={t.id} onClick={() => onSelectTurma(t)} className="card"
                style={{padding:"1.25rem",cursor:"pointer",borderTop:"4px solid "+CORES_FBG[i%CORES_FBG.length]}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.25rem"}}>
                      <div style={{width:"32px",height:"32px",borderRadius:"50%",background:CORES_FBG[i%CORES_FBG.length],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:"800",fontSize:"0.8rem",flexShrink:0}}>
                        {t.nome.replace(/\s/g,"").slice(0,2).toUpperCase()}
                      </div>
                      <p style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>{t.nome}</p>
                    </div>
                    <p style={{fontSize:"0.85rem",color:"var(--text-muted)",marginTop:"0.2rem"}}>{t.disciplina}</p>
                    <span style={{fontSize:"0.7rem",background:"#FFF3ED",color:"var(--accent)",padding:"0.15rem 0.5rem",borderRadius:"999px",fontWeight:"600",marginTop:"0.5rem",display:"inline-block"}}>
                      Formação Básica
                    </span>
                  </div>
                  <button onClick={e => remover(e,t.id)} style={{color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",fontSize:"1rem"}}>✕</button>
                </div>
                <p style={{fontSize:"0.75rem",color:CORES_FBG[i%CORES_FBG.length],marginTop:"0.75rem",fontWeight:"600"}}>Ver planilha →</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seção FTP */}
      {(aba === "todas" || aba === "tecnica") && ftp.length > 0 && (
        <div style={{marginBottom:"1.5rem"}}>
          {aba === "todas" && (
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <div style={{width:"10px",height:"10px",borderRadius:"50%",background:"#2563EB",flexShrink:0}}/>
              <span style={{fontWeight:"700",fontSize:"0.9rem",color:"#2563EB"}}>Formação Técnica</span>
              <span style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>— {ftp.length} turma{ftp.length!==1?"s":""}</span>
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"1rem"}}>
            {ftp.map((t,i) => (
              <div key={t.id} onClick={() => onSelectTurma(t)} className="card"
                style={{padding:"1.25rem",cursor:"pointer",borderTop:"4px solid "+CORES_FTP[i%CORES_FTP.length]}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"0.25rem"}}>
                      <div style={{width:"32px",height:"32px",borderRadius:"50%",background:CORES_FTP[i%CORES_FTP.length],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:"800",fontSize:"0.8rem",flexShrink:0}}>
                        {t.nome.replace(/\s/g,"").slice(0,2).toUpperCase()}
                      </div>
                      <p style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>{t.nome}</p>
                    </div>
                    <p style={{fontSize:"0.85rem",color:"var(--text-muted)",marginTop:"0.2rem"}}>{t.disciplina}</p>
                    <span style={{fontSize:"0.7rem",background:"#EFF6FF",color:"#2563EB",padding:"0.15rem 0.5rem",borderRadius:"999px",fontWeight:"600",marginTop:"0.5rem",display:"inline-block"}}>
                      Formação Técnica
                    </span>
                  </div>
                  <button onClick={e => remover(e,t.id)} style={{color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",fontSize:"1rem"}}>✕</button>
                </div>
                <p style={{fontSize:"0.75rem",color:CORES_FTP[i%CORES_FTP.length],marginTop:"0.75rem",fontWeight:"600"}}>Ver planilha →</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {lista.length === 0 && !form && (
        <p style={{color:"var(--text-muted)",fontStyle:"italic",textAlign:"center",padding:"2rem"}}>
          {aba === "basica" ? "Nenhuma turma de Formação Básica." : aba === "tecnica" ? "Nenhuma turma de Formação Técnica." : "Nenhuma turma registrada ainda."}
        </p>
      )}
    </div>
  )
}
