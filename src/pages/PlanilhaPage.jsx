import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"

const BIMESTRES = ["1 Bimestre","2 Bimestre","3 Bimestre","4 Bimestre"]
const CRITERIOS = ["atividades","participacao","comportamento"]
const LABELS    = ["Atividades","Participação","Comportamento"]

function corNota(n) {
  if (n==="" || n===null || n===undefined) return {}
  const v = Number(n)
  if (v<=4) return { background: "#fce4e4", color: "#a0001a" }
  if (v<=6) return { background: "#fff3e0", color: "#8a5a00" }
  if (v<=8) return { background: "#e6f4ea", color: "#1e5e2e" }
  return { background: "#e0edfb", color: "#003d7a" }
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
    if (!confirm("🔄 Última chance: deseja realmente continuar? Esta ação é irreversível!")) return;
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

  // 🎨 Estilos com alto contraste e responsividade
  const styles = {
    container: {
      marginTop: "1rem",
      fontFamily: "'Crimson Text', Georgia, serif",
      color: "#1a1a1a"
    },
    tabContainer: {
      display: "flex",
      gap: "0.3rem",
      padding: "0.4rem",
      background: "#ede6db",
      borderRadius: "10px",
      marginBottom: "1.2rem",
      flexWrap: "wrap",
      justifyContent: "center"
    },
    tabButton: (active) => ({
      flex: "1 1 auto",
      minWidth: "70px",
      padding: "0.6rem 0.4rem",
      borderRadius: "6px",
      border: "1px solid #b8a68b",
      cursor: "pointer",
      fontFamily: "'Playfair Display', serif",
      fontSize: "clamp(0.8rem, 2vw, 1rem)",
      fontWeight: active ? "700" : "500",
      background: active ? "#4a3728" : "#fcf8f2",
      color: active ? "#fcf8f2" : "#2c1f12",
      transition: "0.2s",
      boxShadow: active ? "0 2px 6px rgba(0,0,0,0.2)" : "none"
    }),
    card: {
      background: "#fcf8f2",
      borderRadius: "12px",
      padding: "0.8rem 0.5rem",
      boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
      border: "1px solid #d6c8b4",
      overflowX: "auto",
      marginBottom: "1.2rem"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      fontFamily: "'Crimson Text', serif",
      fontSize: "0.95rem",
      minWidth: "500px"
    },
    th: {
      background: "#d9c9b0",
      color: "#1a1a1a",
      padding: "0.7rem 0.5rem",
      textAlign: "left",
      fontFamily: "'Playfair Display', serif",
      fontWeight: "700",
      fontSize: "0.9rem",
      borderBottom: "2px solid #b8a68b"
    },
    td: {
      padding: "0.5rem 0.4rem",
      borderBottom: "1px solid #e3d9cb",
      color: "#1a1a1a"
    },
    inputNota: {
      width: "4.2rem",
      textAlign: "center",
      fontFamily: "'Playfair Display', serif",
      fontSize: "1rem",
      fontWeight: "700",
      padding: "0.2rem 0.2rem",
      border: "1px solid #b8a68b",
      borderRadius: "4px",
      background: "white",
      color: "#1a1a1a"
    },
    inputNome: {
      flex: "1 1 180px",
      padding: "0.7rem 0.9rem",
      borderRadius: "8px",
      border: "1px solid #b8a68b",
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      backgroundColor: "white",
      outline: "none",
      color: "#1a1a1a",
      minWidth: "150px"
    },
    inputNomePlaceholder: {
      color: "#6b5a4a"
    },
    btnPrimary: {
      padding: "0.7rem 1.5rem",
      borderRadius: "8px",
      border: "none",
      background: "#4a3728",
      color: "white",
      fontWeight: "700",
      cursor: "pointer",
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      whiteSpace: "nowrap",
      transition: "0.2s",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    },
    btnDanger: {
      padding: "0.7rem 1.5rem",
      borderRadius: "8px",
      border: "none",
      background: "#b22234",
      color: "white",
      fontWeight: "700",
      cursor: "pointer",
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      transition: "0.2s",
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      justifyContent: "center",
      flex: "1 1 200px",
      maxWidth: "320px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.15)"
    },
    btnDangerDisabled: {
      opacity: 0.5,
      cursor: "not-allowed"
    },
    rowEven: {
      background: "#f5efe8"
    },
    rowOdd: {
      background: "transparent"
    },
    emptyRow: {
      padding: "1.8rem",
      textAlign: "center",
      color: "#3e2e1f",
      fontStyle: "italic",
      fontSize: "1rem"
    },
    deleteIcon: {
      color: "#b22234",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: "1.2rem",
      padding: "0.2rem 0.5rem"
    },
    actionRow: {
      marginTop: "0.8rem",
      display: "flex",
      gap: "0.6rem",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "flex-start"
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
              <th style={{...styles.th, textAlign: "left"}}>Aluno</th>
              {LABELS.map(l => (
                <th key={l} style={{...styles.th, textAlign: "center"}}>{l}</th>
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
                <tr key={a.id} style={{...rowStyle, borderBottom: "1px solid #e3d9cb"}}>
                  <td style={{...styles.td, textAlign: "center", color: "#4a3a2a", fontSize: "0.85rem"}}>
                    {String(i+1).padStart(2,"0")}
                  </td>
                  <td style={{...styles.td, fontWeight: "600"}}>{a.nome}</td>
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