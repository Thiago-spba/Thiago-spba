import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore"

export default function AlunosPage({ turma, onSelectAluno }) {
  const [alunos, setAlunos] = useState([])
  const [nome, setNome] = useState("")
  const [form, setForm] = useState(false)

  useEffect(() => {
    const q = query(collection(db,"alunos"), where("turmaId","==",turma.id))
    const unsub = onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({id:d.id,...d.data()}))
      lista.sort((a,b) => a.nome.localeCompare(b.nome))
      setAlunos(lista)
    })
    return unsub
  }, [turma.id])

  const adicionar = async () => {
    if (!nome.trim()) return
    await addDoc(collection(db,"alunos"), {nome:nome.trim(), turmaId:turma.id})
    setNome(""); setForm(false)
  }

  const remover = async (e, id) => {
    e.stopPropagation()
    if (confirm("Remover esse aluno?")) await deleteDoc(doc(db,"alunos",id))
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginTop:"1rem"}}>
      <p style={{color:"var(--parch-accent)",fontFamily:"'Crimson Text',serif",textAlign:"center",fontStyle:"italic",marginBottom:"0.5rem"}}>
        {alunos.length} aluno(s) matriculado(s)
      </p>
      {alunos.map((a, i) => (
        <div key={a.id} onClick={() => onSelectAluno(a)} className="parch-card"
          style={{padding:"0.75rem 1rem",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
            <span style={{color:"var(--parch-border)",fontFamily:"'Crimson Text',serif",fontSize:"0.85rem",minWidth:"2rem"}}>
              {String(i+1).padStart(2,"0")}.
            </span>
            <p style={{fontFamily:"'Crimson Text',serif",fontSize:"1.15rem",color:"var(--parch-dark)"}}>{a.nome}</p>
          </div>
          <button onClick={e => remover(e,a.id)} style={{color:"#8B0000",background:"none",border:"none",cursor:"pointer"}}>✕</button>
        </div>
      ))}
      {form ? (
        <div className="parch-card" style={{padding:"1rem",display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          <input className="parch-input" value={nome} onChange={e => setNome(e.target.value)}
            onKeyDown={e => e.key==="Enter" && adicionar()} placeholder="Nome completo do aluno" autoFocus />
          <div style={{display:"flex",gap:"0.5rem"}}>
            <button className="parch-btn-primary" onClick={adicionar}>Registrar</button>
            <button className="parch-btn-secondary" onClick={() => setForm(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setForm(true)}
          style={{width:"100%",border:"2px dashed var(--parch-border)",color:"var(--parch-accent)",background:"transparent",padding:"1rem",fontFamily:"'Playfair Display',serif",fontSize:"1.1rem",cursor:"pointer",borderRadius:"4px"}}>
          + Registrar Aluno
        </button>
      )}
    </div>
  )
}