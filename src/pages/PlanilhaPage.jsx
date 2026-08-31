import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"

const BIMESTRES = ["1 Bimestre","2 Bimestre","3 Bimestre","4 Bimestre"]
const CRITERIOS = ["atividades","participacao","comportamento"]
const LABELS    = ["Atividades","Participação","Comportamento"]

function corNota(n, darkMode) {
  if (n==="" || n===null || n===undefined) return {}
  const v = Number(n)
  const base = darkMode ? {
    bgLow: "#4a1a1a", colorLow: "#ffb3b3",
    bgMed: "#4a3a1a", colorMed: "#ffe0b3",
    bgHigh: "#1a3a1a", colorHigh: "#b3ffb3",
    bgTop: "#1a2a4a", colorTop: "#b3d9ff"
  } : {
    bgLow: "#fce4e4", colorLow: "#a0001a",
    bgMed: "#fff3e0", colorMed: "#8a5a00",
    bgHigh: "#e6f4ea", colorHigh: "#1e5e2e",
    bgTop: "#e0edfb", colorTop: "#003d7a"
  }
  if (v<=4) return { background: base.bgLow, color: base.colorLow }
  if (v<=6) return { background: base.bgMed, color: base.colorMed }
  if (v<=8) return { background: base.bgHigh, color: base.colorHigh }
  return { background: base.bgTop, color: base.colorTop }
}

export default function PlanilhaPage({ turma }) {
  // Estados principais
  const [bimestre, setBimestre] = useState("1 Bimestre")
  const [alunos, setAlunos]    = useState([])
  const [notas, setNotas]      = useState({})
  const [local, setLocal]      = useState({})
  const [nome, setNome]        = useState("")
  const [carregando, setCarregando] = useState(false)
  const [accordionOpen, setAccordionOpen] = useState(false)

  // Detecta dark mode via classe no html
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    const checkDark = () => {
      const isDark = document.documentElement.classList.contains('dark') ||
                     document.documentElement.getAttribute('data-theme') === 'dark'
      setDarkMode(isDark)
    }
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Função para limpar turma
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

  // Firestore listeners
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

  // Funções auxiliares
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

  // Cores dinâmicas para dark mode
  const colors = {
    bg: darkMode ? "#1a1a1a" : "#fcf8f2",
    card: darkMode ? "#2a2a2a" : "#fcf8f2",
    cardBorder: darkMode ? "#444" : "#d6c8b4",
    text: darkMode ? "#e0dcd6" : "#1a1a1a",
    textSecondary: darkMode ? "#aaa" : "#3e2e1f",
    headerBg: darkMode ? "#3a3a3a" : "#d9c9b0",
    headerText: darkMode ? "#f0ece6" : "#1a1a1a",
    tabInactive: darkMode ? "#2a2a2a" : "#fcf8f2",
    tabActive: darkMode ? "#5a4a3a" : "#4a3728",
    tabTextInactive: darkMode ? "#ccc" : "#2c1f12",
    tabTextActive: darkMode ? "#f0ece6" : "#fcf8f2",
    inputBg: darkMode ? "#333" : "white",
    inputBorder: darkMode ? "#555" : "#b8a68b",
    placeholder: darkMode ? "#888" : "#6b5a4a",
    btnPrimary: darkMode ? "#5a4a3a" : "#4a3728",
    btnPrimaryText: darkMode ? "#f0ece6" : "white",
    btnDanger: darkMode ? "#8b1a1a" : "#b22234",
    btnDangerText: "white",
    rowEven: darkMode ? "#222" : "#f5efe8",
    rowOdd: darkMode ? "transparent" : "transparent",
    deleteIcon: darkMode ? "#cc4444" : "#b22234",
    shadow: darkMode ? "0 4px 14px rgba(0,0,0,0.5)" : "0 4px 14px rgba(0,0,0,0.08)"
  }

  // Estilos
  const styles = {
    container: {
      marginTop: "1rem",
      fontFamily: "'Crimson Text', Georgia, serif",
      color: colors.text
    },
    accordionWrapper: {
      marginBottom: "1.2rem"
    },
    accordionButton: {
      width: "100%",
      padding: "0.8rem 1rem",
      background: colors.tabActive,
      color: colors.tabTextActive,
      border: `1px solid ${colors.cardBorder}`,
      borderRadius: "10px",
      fontSize: "1rem",
      fontWeight: "700",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      fontFamily: "'Playfair Display', serif",
      transition: "0.2s"
    },
    accordionIcon: {
      fontSize: "1.2rem",
      transition: "transform 0.3s",
      transform: accordionOpen ? "rotate(180deg)" : "rotate(0deg)"
    },
    accordionContent: {
      overflow: "hidden",
      maxHeight: accordionOpen ? "300px" : "0",
      transition: "max-height 0.3s ease",
      background: colors.card,
      borderRadius: "0 0 10px 10px",
      border: accordionOpen ? `1px solid ${colors.cardBorder}` : "none",
      borderTop: "none"
    },
    accordionList: {
      listStyle: "none",
      margin: 0,
      padding: "0.5rem 0",
      display: "flex",
      flexDirection: "column",
      gap: "0.2rem"
    },
    accordionItem: (isSelected) => ({
      padding: "0.6rem 1rem",
      cursor: "pointer",
      background: isSelected ? colors.tabActive : "transparent",
      color: isSelected ? colors.tabTextActive : colors.text,
      fontWeight: isSelected ? "700" : "400",
      transition: "0.15s",
      borderRadius: "4px",
      margin: "0 0.3rem",
      border: "none",
      textAlign: "left",
      fontFamily: "'Crimson Text', serif",
      fontSize: "0.95rem"
    }),
    card: {
      background: colors.card,
      borderRadius: "12px",
      padding: "0.8rem 0.5rem",
      boxShadow: colors.shadow,
      border: `1px solid ${colors.cardBorder}`,
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
      background: colors.headerBg,
      color: colors.headerText,
      padding: "0.7rem 0.5rem",
      textAlign: "left",
      fontFamily: "'Playfair Display', serif",
      fontWeight: "700",
      fontSize: "0.9rem",
      borderBottom: `2px solid ${colors.cardBorder}`
    },
    td: {
      padding: "0.5rem 0.4rem",
      borderBottom: `1px solid ${colors.cardBorder}`,
      color: colors.text
    },
    inputNota: {
      width: "4.2rem",
      textAlign: "center",
      fontFamily: "'Playfair Display', serif",
      fontSize: "1rem",
      fontWeight: "700",
      padding: "0.2rem 0.2rem",
      border: `1px solid ${colors.inputBorder}`,
      borderRadius: "4px",
      background: colors.inputBg,
      color: colors.text
    },
    inputNome: {
      flex: "1 1 180px",
      padding: "0.7rem 0.9rem",
      borderRadius: "8px",
      border: `1px solid ${colors.inputBorder}`,
      fontFamily: "'Crimson Text', serif",
      fontSize: "1rem",
      background: colors.inputBg,
      color: colors.text,
      outline: "none",
      minWidth: "150px"
    },
    btnPrimary: {
      padding: "0.7rem 1.5rem",
      borderRadius: "8px",
      border: "none",
      background: colors.btnPrimary,
      color: colors.btnPrimaryText,
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
      background: colors.btnDanger,
      color: colors.btnDangerText,
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
      background: colors.rowEven
    },
    rowOdd: {
      background: colors.rowOdd
    },
    emptyRow: {
      padding: "1.8rem",
      textAlign: "center",
      color: colors.textSecondary,
      fontStyle: "italic",
      fontSize: "1rem"
    },
    deleteIcon: {
      color: colors.deleteIcon,
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
      {/* Accordion de bimestres */}
      <div style={styles.accordionWrapper}>
        <button 
          style={styles.accordionButton} 
          onClick={() => setAccordionOpen(!accordionOpen)}
        >
          <span>📚 {bimestre}</span>
          <span style={styles.accordionIcon}>▼</span>
        </button>
        <div style={styles.accordionContent}>
          <ul style={styles.accordionList}>
            {BIMESTRES.map(b => (
              <li key={b}>
                <button
                  style={styles.accordionItem(b === bimestre)}
                  onClick={() => {
                    setBimestre(b)
                    setAccordionOpen(false)
                  }}
                >
                  {b}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Tabela */}
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
                <tr key={a.id} style={{...rowStyle, borderBottom: `1px solid ${colors.cardBorder}`}}>
                  <td style={{...styles.td, textAlign: "center", color: colors.textSecondary, fontSize: "0.85rem"}}>
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
                          style={{...styles.inputNota, ...corNota(val, darkMode)}}
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

      {/* Ações */}
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