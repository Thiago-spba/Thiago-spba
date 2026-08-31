import { useState, useEffect } from "react"
import TurmasPage from "./pages/TurmasPage"
import PlanilhaPage from "./pages/PlanilhaPage"

export default function App() {
  const [pagina, setPagina] = useState("turmas")
  const [turmaSel, setTurmaSel] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem("dark") === "true")

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("dark", dark)
  }, [dark])

  const irPlanilha = (t) => { setTurmaSel(t); setPagina("planilha") }
  const voltar = () => setPagina("turmas")

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)"}}>
      <header className="app-header">
        <div className="header-inner">
          <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flex:1,minWidth:0}}>
            {pagina !== "turmas" && (
              <button onClick={voltar} className="btn-ghost" style={{padding:"0.4rem 0.8rem",fontSize:"0.85rem"}}>
                ← Voltar
              </button>
            )}
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                <span style={{fontSize:"1.25rem"}}>📋</span>
                <span style={{fontWeight:"700",fontSize:"1rem",color:"var(--text)"}}>Diario do Professor</span>
              </div>
              {pagina === "planilha" && turmaSel && (
                <p style={{fontSize:"0.75rem",color:"var(--text-muted)",marginTop:"0.1rem"}}>{turmaSel.nome} — {turmaSel.disciplina}</p>
              )}
            </div>
          </div>
          <button onClick={() => setDark(!dark)}
            style={{background:"none",border:"1px solid var(--border)",borderRadius:"8px",padding:"0.4rem 0.6rem",cursor:"pointer",fontSize:"1rem",flexShrink:0}}>
            {dark ? "☀️" : "🌙"}
          </button>
        </div>
      </header>
      <main style={{maxWidth:"960px",margin:"0 auto",padding:"1rem"}}>
        {pagina === "turmas" && <TurmasPage onSelectTurma={irPlanilha} />}
        {pagina === "planilha" && <PlanilhaPage turma={turmaSel} />}
      </main>
    </div>
  )
}