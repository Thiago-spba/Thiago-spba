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
  const [aba, setAba] = useState("basica")

  useEffect(() => {
    return onSnapshot(collection(db,"turmas"), snap => {
      setTurmas(snap.docs.map(d => ({id:d.id,...d.data()})))
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
    if (confirm("Remover essa turma?")) await deleteDoc(doc(db,"turmas",id))
  }

  const fbg = turmas.filter(t => t.tipo !== "tecnica")
  const ftp = turmas.filter(t => t.tipo === "tecnica")
  const lista = aba === "basica" ? fbg : ftp
  const cores = aba === "basica" ? CORES_FBG : CORES_FTP
  const cor_aba = aba === "basica" ? "var(--accent)" : "#2563EB"

  return (
    <div style={{paddingTop:"1rem"}}>
      {/* Hero */}
      <div className="hero-card" style={{marginBottom:"1.5rem"}}>
        <span className="badge">📋 Portal do Professor</span>
        <h1 style={{fontSize:"clamp(1.5rem,5vw,2rem)",fontWeight:"800",margin:"0.75rem 0 0.5rem",color:"var(--text)"}}>
          Prof. Thiago Fernando
        </h1>
        <p style={{color:"var(--text-muted)",fontSize:"0.95rem",fontStyle:"italic"}}>
          "A historia explica de onde viemos; a tecnologia programa o seu futuro."
        </p>
      </div>

      {/* Cabeçalho + botão + */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem",flexWrap:"wrap",gap:"0.75rem"}}>
        <div>
          <h2 style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>Painel de Turmas</h2>
          <p style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>Selecione uma turma para lançar as avaliações</p>
        </div>
        <button onClick={() => setForm(!form)} title="Nova Turma"
          style={{width:"48px",height:"48px",borderRadius:"50%",background:"var(--accent)",color:"white",
            border:"none",fontSize:"1.6rem",cursor:"pointer",display:"flex",alignItems:"center",
            justifyContent:"center",boxShadow:"0 4px 12px rgba(232,84,10,0.4)",flexShrink:0}}>+</button>
      </div>

      {/* Abas FBG / FTP */}
      <div className="abas-turma" style={{display:"flex",gap:"0.5rem",marginBottom:"1.5rem"}}>
        <button onClick={()=>setAba("basica")} style={{
          flex:1, padding:"0.6rem 0.5rem", borderRadius:"10px", border:"none", cursor:"pointer",
          fontWeight:"700", fontSize:"0.9rem", transition:"all 0.15s",
          background: aba==="basica" ? "var(--accent)" : "var(--bg-card)",
          color: aba==="basica" ? "white" : "var(--text-muted)",
          boxShadow: aba==="basica" ? "0 2px 8px rgba(232,84,10,0.35)" : "none",
          border: aba==="basica" ? "none" : "1px solid var(--border)"
        }}>
          🟠 FBG — Básica ({fbg.length})
        </button>
        <button onClick={()=>setAba("tecnica")} style={{
          flex:1, padding:"0.6rem 0.5rem", borderRadius:"10px", border:"none", cursor:"pointer",
          fontWeight:"700", fontSize:"0.9rem", transition:"all 0.15s",
          background: aba==="tecnica" ? "#2563EB" : "var(--bg-card)",
          color: aba==="tecnica" ? "white" : "var(--text-muted)",
          boxShadow: aba==="tecnica" ? "0 2px 8px rgba(37,99,235,0.35)" : "none",
          border: aba==="tecnica" ? "none" : "1px solid var(--border)"
        }}>
          🔵 FTP — Técnica ({ftp.length})
        </button>
      </div>

      {/* Form nova turma */}
      {form && (
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

      {/* Cards circulares */}
      {lista.length === 0 ? (
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
          gridTemplateColumns:"repeat(auto-fill, minmax(130px, 1fr))",
          gap:"1rem"
        }}>
          {lista.map((t, i) => {
            const cor = cores[i % cores.length]
            const iniciais = t.nome.replace(/\s/g,"").slice(0,2).toUpperCase()
            return (
              <div key={t.id} onClick={()=>onSelectTurma(t)}
                style={{
                  display:"flex", flexDirection:"column", alignItems:"center",
                  gap:"0.6rem", padding:"1rem 0.5rem", borderRadius:"14px",
                  background:"var(--bg-card)", border:"1px solid var(--border)",
                  cursor:"pointer", position:"relative", transition:"box-shadow 0.2s, transform 0.15s",
                  boxShadow:"var(--shadow)"
                }}
                onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.18)";e.currentTarget.style.transform="translateY(-2px)"}}
                onMouseLeave={e=>{e.currentTarget.style.boxShadow="var(--shadow)";e.currentTarget.style.transform="translateY(0)"}}>

                {/* Botão remover */}
                <button onClick={e=>remover(e,t.id)}
                  style={{position:"absolute",top:"6px",right:"8px",background:"none",border:"none",
                    cursor:"pointer",color:"var(--text-muted)",fontSize:"0.85rem",lineHeight:1,padding:"2px"}}>✕</button>

                {/* Círculo com iniciais */}
                <div style={{
                  width:"72px", height:"72px", borderRadius:"50%",
                  background:`linear-gradient(135deg, ${cor}dd, ${cor})`,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  color:"white", fontWeight:"900", fontSize:"1.35rem",
                  boxShadow:`0 4px 12px ${cor}55`, letterSpacing:"0.02em", flexShrink:0
                }}>
                  {iniciais}
                </div>

                {/* Nome e disciplina */}
                <div style={{textAlign:"center",width:"100%",padding:"0 0.25rem"}}>
                  <p style={{fontWeight:"800",fontSize:"1rem",color:"var(--text)",lineHeight:1.2}}>
                    {t.nome}
                  </p>
                  <p style={{fontSize:"0.7rem",color:"var(--text-muted)",marginTop:"0.2rem",
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>
                    {t.disciplina}
                  </p>
                </div>

                {/* Ver planilha */}
                <span style={{fontSize:"0.7rem",color:cor,fontWeight:"700",marginTop:"0.1rem"}}>
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
