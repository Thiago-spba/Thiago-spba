import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"

const BIMESTRES = ["1 Bimestre","2 Bimestre","3 Bimestre","4 Bimestre"]
const CRITERIOS = ["atividades","participacao","comportamento"]
const LABELS    = ["Atividades","Participação","Comportamento"]

function corNota(n) {
  if (n==="" || n===null || n===undefined) return {}
  const v = Number(n)
  if (v<=4) return { background: "#fce4e4", color: "#b00020" }
  if (v<=6) return { background: "#fff3e0", color: "#b26a00" }
  if (v<=8) return { background: "#e8f5e9", color: "#1e5e2e" }
  return { background: "#e3f2fd", color: "#0d47a1" }
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

  // Estilos inline para o tema parchment
  const styles = {
    container: {
      marginTop: "1rem",
      fontFamily: "'Crimson Text', serif",
      color: "#3e2e1f"
    },
    card: {
      backgroundColor: "#fcf7f0",
      borderRadius: "12px",
      padding: "1rem",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      border: "1px solid #e8dccc",
      overflowX: "auto",
      marginBottom: "1rem"
    },
    tabContainer: {
      display: "flex",
      gap: "0.25rem",
      padding: "0.4rem",
      backgroundColor: "#f5ede3",
      borderRadius: "8px",
      marginBottom: "1rem",
      flexWrap: "wrap"
    },
    tabButton: (active) => ({
      flex: 1,
      padding: "0.5rem 0.2rem",
      borderRadius: "6px",
      border: "none",
      cursor: "pointer",
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(0.7rem, 2vw, 0.9rem)",
      fontWeight: active ? "700" : "400",
      background: active ? "linear-gradient(135deg, #6b3f1f, #8b5a3a)" : "transparent",
      color: active ? "#fcf7f0" : "#6b4f2e",
      transition: "all 0.2s",
      minWidth: "60px"
    }),
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "'Crimson Text', serif",
      fontSize: "0.95rem"
    },
    th: {
      backgroundColor: "#d8c9b0",
      color: "#2c1f12",
      padding: "0.6rem 0.5rem",
      textAlign: "left",
      fontFamily: "'Playfair Display', serif",
      fontWeight: "600",
      fontSize: "0.85rem"
    },
    td: {
      padding: "0.4rem 0.5rem",
      borderBottom: "1px solid #ece3d7"
    },
    inputNota: {
      width: "4.2rem",
      textAlign: "center",
      fontFamily: "'Playfair Display', serif",
      fontSize: "1rem",
      fontWeight: "700",
      padding: "0.25rem 0.3rem",
      border: "1px solid #d4c5b0",
      borderRadius: "4px",
      background: "white"
    },
    inputNome: {
      flex: 1,
      minWidth: "180px",
      padding: "0.6rem 0.8rem",
      borderRadius: "8px",
      border: "1px solid #d4c5b0",
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      backgroundColor: "white",
      outline: "none"
    },
    btnPrimary: {
      padding: "0.6rem 1.2rem",
      borderRadius: "8px",
      border: "none",
      backgroundColor: "#6b3f1f",
      color: "white",
      fontWeight: "600",
      cursor: "pointer",
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      whiteSpace: "nowrap",
      transition: "background 0.2s"
    },
    btnDanger: {
      padding: "0.6rem 1.2rem",
      borderRadius: "8px",
      border: "none",
      backgroundColor: "#b33c3c",
      color: "white",
      fontWeight: "600",
      cursor: "pointer",
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      transition: "background 0.2s",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      justifyContent: "center",
      width: "100%",
      maxWidth: "300px"
    },
    btnDangerDisabled: {
      opacity: 0.5,
      cursor: "not-allowed"
    },
    rowEven: {
      backgroundColor: "#f8f2ea"
    },
    rowOdd: {
      backgroundColor: "transparent"
    },
    emptyRow: {
      padding: "1.5rem",
      textAlign: "center",
      color: "#8a7a6a",
      fontStyle: "italic"
    },
    deleteIcon: {
      color: "#b33c3c",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: "1.1rem"
    },
    actionRow: {
      marginTop: "0.75rem",
      display: "flex",
      gap: "0.5rem",
      flexWrap: "wrap",
      alignItems: "center"
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.tabContainer}>
        {BIMESTRES.map(b => (
          <button key={b} onClick={() => setBimestre(b)} style={styles.tabButton(bimestre === b)}>
            {b}
          </button>
        ))}
      </div>

      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={{...styles.th, textAlign: "left", minWidth: "10rem"}}>Aluno</th>
              {LABELS.map(l => (
                <th key={l} style={{...styles.th, textAlign: "center", minWidth: "5.5rem"}}>{l}</th>
              ))}
              <th style={{...styles.th, textAlign: "center", width: "3rem"}}></th>
            </tr>
          </thead>
          <tbody>
            {alunos.length === 0 && (
              <tr><td colSpan="6" style={styles.emptyRow}>Nenhum aluno registrado</td></tr>
            )}
            {alunos.map((a, i) => {
              const rowStyle = i % 2 === 0 ? styles.rowEven : styles.rowOdd
              return (
                <tr key={a.id} style={{...rowStyle, borderBottom: "1px solid #ece3d7"}}>
                  <td style={{...styles.td, textAlign: "center", color: "#8a7a6a", fontSize: "0.8rem"}}>
                    {String(i+1).padStart(2,"0")}
                  </td>
                  <td style={{...styles.td, fontWeight: "500"}}>{a.nome}</td>
                  {CRITERIOS.map(c => {
                    const val = getVal(a.id, c)
                    return (
                      <td key={c} style={{...styles.td, textAlign: "center"}}>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          step="0.5"
                          value={val}
                          onChange={e => onChange(a.id, c, e.target.value)}
                          onBlur={e => onBlur(a.id, c, e.target.value)}
                          style={{...styles.inputNota, ...corNota(val)}}
                        />
                      </td>
                    )
                  })}
                  <td style={{...styles.td, textAlign: "center"}}>
                    <button onClick={() => delAluno(a.id)} style={styles.deleteIcon}>✕</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.actionRow}>
        <input
          style={styles.inputNome}
          value={nome}
          onChange={e => setNome(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addAluno()}
          placeholder="Nome do aluno — Enter para registrar"
        />
        <button style={styles.btnPrimary} onClick={addAluno}>
          + Registrar
        </button>
        <button
          onClick={limparTurmaToda}
          disabled={alunos.length === 0 || carregando}
          style={{
            ...styles.btnDanger,
            ...(alunos.length === 0 || carregando ? styles.btnDangerDisabled : {})
          }}
        >
          {carregando ? "⏳ Apagando..." : "🗑️ Apagar Todos os Alunos"}
        </button>
      </div>
    </div>
  )
}
