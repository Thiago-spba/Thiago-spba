import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"

const BIMESTRES = ["1 Bimestre","2 Bimestre","3 Bimestre","4 Bimestre"]
const CRITERIOS = ["atividades","participacao","comportamento"]
const LABELS    = ["Atividades","Participacao","Comportamento"]

function corNota(n) {
  if (n==="" || n===null || n===undefined) return {}
  const v = Number(n)
  if (v<=4) return {background:"#FFF0F0",color:"#8B0000"}
  if (v<=6) return {background:"#FFF8E7",color:"#92650C"}
  if (v<=8) return {background:"#EFF5EF",color:"#2E5E2E"}
  return {background:"#EBF5FB",color:"#1B4F72"}
}

export default function PlanilhaPage({ turma }) {
  const [bimestre, setBimestre] = useState("1 Bimestre")
  const [alunos, setAlunos]    = useState([])
  const [notas, setNotas]      = useState({})
  const [local, setLocal]      = useState({})
  const [nome, setNome]        = useState("")
  const [carregando, setCarregando] = useState(false)

  const limparTurmaToda = async () => {
    if (!confirm("⚠️ ATENÇÃO: Isso apagará TODOS os alunos, notas e relatórios desta turma. Tem certeza absoluta?")) return;
    
    setCarregando(true);
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
    setCarregando(false);
  };

  useEffect(() => {
    const q = query(collection(db,"alunos"), where("turmaId","==",turma.id))
    return onSnapshot(q, snap => {
      const lista = snap.docs.map(d => ({id:d.id,...d.data()}))
      lista.sort((a,b) => a.nome.localeCompare(b.nome))
      setAlunos(lista)
    })
  }, [turma.id])

  useEffect(() => {
    const q = query(collection(db,"notas"),
      where("turmaId","==",turma.id),
      where("trimestre","==",bimestre))
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

  const onChange = (alunoId, campo, val) => {
    const k = alunoId+"_"+campo
    setLocal(prev => ({...prev, [k]:val}))
  }

  const onBlur = async (alunoId, campo, val) => {
    const k = alunoId+"_"+campo
    setLocal(prev => { const n={...prev}; delete n[k]; return n })
    if (val !== "" && (Number(val) < 0 || Number(val) > 10)) return
    const atual = notas[alunoId] || {}
    if (atual.docId) {
      await updateDoc(doc(db,"notas",atual.docId), {[campo]:val})
    } else {
      await addDoc(collection(db,"notas"), {
        alunoId, turmaId:turma.id, trimestre:bimestre,
        atividades:"", participacao:"", comportamento:"", [campo]:val
      })
    }
  }

  const addAluno = async () => {
    if (!nome.trim()) return
    await addDoc(collection(db,"alunos"), {nome:nome.trim(), turmaId:turma.id})
    setNome("")
  }

  const delAluno = async (id) => {
    if (confirm("Remover esse aluno?")) await deleteDoc(doc(db,"alunos",id))
  }

  return (
    <div style={{marginTop:"1rem"}}>
      <div className="parch-card" style={{display:"flex",padding:"0.4rem",gap:"0.25rem",marginBottom:"1rem"}}>
        {BIMESTRES.map(b => (
          <button key={b} onClick={() => setBimestre(b)}
            style={{flex:1,padding:"0.5rem 0.1rem",borderRadius:"3px",border:"none",cursor:"pointer",
              fontFamily:"'Crimson Text',serif",fontSize:"clamp(0.7rem,2.5vw,0.85rem)",
              background:bimestre===b?"linear-gradient(135deg,#5C2D0A,#8B4513)":"transparent",
              color:bimestre===b?"#FBF0D5":"var(--parch-accent)"}}>
            {b}
          </button>
        ))}
      </div>

      <div className="parch-card" style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Crimson Text',serif"}}>
          <thead>
            <tr style={{background:"var(--parch-dark)"}}>
              <th style={{color:"#FBF0D5",padding:"0.6rem 0.5rem",fontFamily:"'Playfair Display',serif",fontSize:"0.85rem",textAlign:"left"}}>#</th>
              <th style={{color:"#FBF0D5",padding:"0.6rem 0.5rem",fontFamily:"'Playfair Display',serif",fontSize:"0.85rem",textAlign:"left",minWidth:"10rem"}}>Aluno</th>
              {LABELS.map(l => (
                <th key={l} style={{color:"#FBF0D5",padding:"0.6rem 0.5rem",fontFamily:"'Playfair Display',serif",fontSize:"0.85rem",textAlign:"center",minWidth:"5.5rem"}}>{l}</th>
              ))}
              <th style={{color:"#FBF0D5",padding:"0.6rem 0.5rem"}}></th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 && (
              <tr><td colSpan="6" style={{padding:"1.5rem",textAlign:"center",color:"var(--parch-accent)",fontStyle:"italic"}}>Nenhum aluno registrado</td></tr>
            )}
            {alunos.map((a, i) => (
              <tr key={a.id} style={{background:i%2===0?"var(--parch-card)":"var(--parch-bg)",borderBottom:"1px solid var(--parch-border)"}}>
                <td style={{padding:"0.4rem 0.5rem",color:"var(--parch-border)",fontSize:"0.8rem",textAlign:"center"}}>{String(i+1).padStart(2,"0")}</td>
                <td style={{padding:"0.4rem 0.5rem",color:"var(--parch-dark)",fontSize:"1rem"}}>{a.nome}</td>
                {CRITERIOS.map(c => {
                  const val = getVal(a.id, c)
                  return (
                    <td key={c} style={{padding:"0.3rem",textAlign:"center"}}>
                      <input type="number" min="0" max="10" step="0.5"
                        value={val}
                        onChange={e => onChange(a.id, c, e.target.value)}
                        onBlur={e => onBlur(a.id, c, e.target.value)}
                        style={{width:"3.8rem",textAlign:"center",
                          fontFamily:"'Playfair Display',serif",fontSize:"1rem",fontWeight:"700",
                          padding:"0.25rem",border:"1px solid var(--parch-border)",borderRadius:"3px",
                          ...corNota(val)}}
                      />
                    </td>
                  )
                })}
                <td style={{padding:"0.3rem",textAlign:"center"}}>
                  <button onClick={() => delAluno(a.id)} style={{color:"#8B0000",background:"none",border:"none",cursor:"pointer"}}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{marginTop:"0.75rem",display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
        <input className="parch-input" value={nome} onChange={e => setNome(e.target.value)}
          onKeyDown={e => e.key==="Enter" && addAluno()}
          placeholder="Nome do aluno — Enter para registrar"
          style={{flex:1,minWidth:"200px"}} />
        <button className="parch-btn-primary" onClick={addAluno}
          style={{width:"auto",minWidth:"7rem",whiteSpace:"nowrap"}}>
          + Registrar
        </button>
        
        <button 
          onClick={limparTurmaToda} 
          disabled={alunos.length === 0 || carregando}
          style={{
            background: alunos.length === 0 ? "#f87171" : "#DC2626",
            color: "white",
            border: "none",
            borderRadius: "8px",
            padding: "0.75rem 1rem",
            cursor: alunos.length === 0 ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "0.9rem",
            width: "100%",
            maxWidth: "300px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "0.5rem",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            fontFamily: "'Crimson Text',serif"
          }}>
          {carregando ? "⏳ Apagando..." : "🗑️ Apagar Todos os Alunos"}
        </button>
      </div>
    </div>
  )
}
