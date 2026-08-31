import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore"

const CORES = ["#E8540A","#2563EB","#16A34A","#D97706","#9333EA","#DC2626"]

export default function TurmasPage({ onSelectTurma }) {
  const [turmas, setTurmas] = useState([])
  const [nome, setNome] = useState("")
  const [disciplina, setDisciplina] = useState("")
  const [tipo, setTipo] = useState("basica")
  const [form, setForm] = useState(false)

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

  return (
    <div style={{paddingTop:"1rem"}}>
      <div className="hero-card" style={{marginBottom:"1.5rem"}}>
        <span className="badge">📋 Portal do Professor</span>
        <h1 style={{fontSize:"clamp(1.5rem,5vw,2rem)",fontWeight:"800",margin:"0.75rem 0 0.5rem",color:"var(--text)"}}>Prof. Thiago Fernando</h1>
        <p style={{color:"var(--text-muted)",fontSize:"0.95rem",fontStyle:"italic"}}>"A historia explica de onde viemos; a tecnologia programa o seu futuro."</p>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div>
          <h2 style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>Painel de Turmas</h2>
          <p style={{fontSize:"0.8rem",color:"var(--text-muted)"}}>Selecione uma turma para lançar as avaliações</p>
        </div>
        <button onClick={() => setForm(!form)} title="Nova Turma" style={{width:"48px",height:"48px",borderRadius:"50%",background:"var(--accent)",color:"white",border:"none",fontSize:"1.6rem",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 4px 12px rgba(232,84,10,0.4)",flexShrink:0}}>+</button>
      </div>
      {form && (
        <div className="card" style={{padding:"1rem",marginBottom:"1rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <h3 style={{fontWeight:"600",color:"var(--text)"}}>Registrar Nova Turma</h3>
          <input className="input-modern" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da turma (ex: 1G)" />
          <input className="input-modern" value={disciplina} onChange={e => setDisciplina(e.target.value)} placeholder="Disciplina (ex: História)" />
          <select className="input-modern" value={tipo} onChange={e => setTipo(e.target.value)}>
            <option value="basica">Formação Básica — História, etc.</option>
            <option value="tecnica">Formação Técnica — Software, Competencias, etc.</option>
          </select>
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button className="btn-primary" onClick={adicionar}>Registrar</button>
            <button className="btn-ghost" onClick={() => setForm(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:"1rem"}}>
        {turmas.length===0 && !form && <p style={{color:"var(--text-muted)",fontStyle:"italic",gridColumn:"1/-1",textAlign:"center",padding:"2rem"}}>Nenhuma turma registrada ainda.</p>}
        {turmas.map((t,i) => (
          <div key={t.id} onClick={() => onSelectTurma(t)} className="card"
            style={{padding:"1.25rem",cursor:"pointer",borderTop:"4px solid "+CORES[i%CORES.length]}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <p style={{fontWeight:"700",fontSize:"1.1rem",color:"var(--text)"}}>{t.nome}</p>
                <p style={{fontSize:"0.85rem",color:"var(--text-muted)",marginTop:"0.2rem"}}>{t.disciplina}</p>
                <span style={{fontSize:"0.7rem",background:t.tipo==="tecnica"?"#EFF6FF":"#F0FDF4",color:t.tipo==="tecnica"?"#2563EB":"#16A34A",padding:"0.15rem 0.5rem",borderRadius:"999px",fontWeight:"600",marginTop:"0.5rem",display:"inline-block"}}>
                  {t.tipo==="tecnica" ? "Formação Técnica" : "Formação Básica"}
                </span>
              </div>
              <button onClick={e => remover(e,t.id)} style={{color:"var(--text-muted)",background:"none",border:"none",cursor:"pointer",fontSize:"1rem"}}>✕</button>
            </div>
            <p style={{fontSize:"0.75rem",color:CORES[i%CORES.length],marginTop:"0.75rem",fontWeight:"600"}}>Ver planilha →</p>
          </div>
        ))}
      </div>
    </div>
  )
}