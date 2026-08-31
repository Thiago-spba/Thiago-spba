import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, updateDoc, doc, onSnapshot, query, where } from "firebase/firestore"

const CRIT = [{key:"atividades",label:"Atividades"},{key:"participacao",label:"Participacao"},{key:"comportamento",label:"Comportamento"}]
const TRIM = ["1 Trimestre","2 Trimestre","3 Trimestre"]

function cor(n) {
  if (n==="" || n===null) return ""
  const v = Number(n)
  if (v<=4) return "nota-insuf"
  if (v<=6) return "nota-reg"
  if (v<=8) return "nota-bom"
  return "nota-otimo"
}

function conceito(n) {
  if (n==="" || n===null) return "-"
  const v = Number(n)
  if (v<=4) return "Insuficiente"
  if (v<=6) return "Regular"
  if (v<=8) return "Bom"
  return "Otimo"
}

export default function NotasPage({ aluno, turma }) {
  const [trim, setTrim] = useState("1 Trimestre")
  const [notas, setNotas] = useState({atividades:"",participacao:"",comportamento:""})
  const [docId, setDocId] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const q = query(collection(db,"notas"), where("alunoId","==",aluno.id), where("trimestre","==",trim))
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        const d = snap.docs[0]
        setDocId(d.id)
        setNotas({atividades:d.data().atividades??"",participacao:d.data().participacao??"",comportamento:d.data().comportamento??""})
      } else {
        setDocId(null)
        setNotas({atividades:"",participacao:"",comportamento:""})
      }
    })
  }, [aluno.id, trim])

  const salvar = async () => {
    setSalvando(true)
    const dados = {alunoId:aluno.id, turmaId:turma.id, trimestre:trim, ...notas}
    if (docId) await updateDoc(doc(db,"notas",docId), dados)
    else await addDoc(collection(db,"notas"), dados)
    setSalvando(false)
  }

  const mudar = (campo, val) => {
    if (val==="" || (Number(val)>=0 && Number(val)<=10)) setNotas(p => ({...p,[campo]:val}))
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"1rem",marginTop:"1rem"}}>
      <div className="parch-card" style={{display:"flex",padding:"0.5rem",gap:"0.25rem"}}>
        {TRIM.map(t => (
          <button key={t} onClick={() => setTrim(t)}
            style={{flex:1,padding:"0.5rem 0.15rem",borderRadius:"3px",border:"none",cursor:"pointer",
              fontFamily:"'Crimson Text',serif",fontSize:"clamp(0.75rem,3vw,0.9rem)",
              background:trim===t?"linear-gradient(135deg,#5C2D0A,#8B4513)":"transparent",
              color:trim===t?"#FBF0D5":"var(--parch-accent)"}}>
            {t}
          </button>
        ))}
      </div>
      {CRIT.map(({key,label}) => (
        <div key={key} className={"parch-card "+cor(notas[key])} style={{padding:"1rem"}}>
          <p style={{fontFamily:"'Playfair Display',serif",fontSize:"1rem",marginBottom:"0.5rem",fontWeight:"600"}}>{label}</p>
          <div style={{display:"flex",alignItems:"center",gap:"1rem"}}>
            <input type="number" min="0" max="10" step="0.5" value={notas[key]}
              onChange={e => mudar(key,e.target.value)}
              style={{width:"4.5rem",border:"1px solid var(--parch-border)",borderRadius:"3px",padding:"0.5rem",
                textAlign:"center",fontSize:"2rem",fontFamily:"'Playfair Display',serif",fontWeight:"700",
                background:"#FFFDF5",color:"var(--parch-dark)"}} />
            <p style={{fontFamily:"'Playfair Display',serif",fontSize:"1.2rem",fontWeight:"600"}}>{conceito(notas[key])}</p>
          </div>
        </div>
      ))}
      <button className="parch-btn-primary" onClick={salvar} disabled={salvando}>
        {salvando ? "Registrando..." : "Registrar Avaliacao"}
      </button>
      <button className="parch-btn-secondary" disabled style={{opacity:0.6,cursor:"not-allowed"}}>
        Gerar Relatorio com IA (em breve)
      </button>
    </div>
  )
}