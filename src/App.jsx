import { useState, useEffect } from "react"
import { auth, signOut } from "./firebase"
import { onAuthStateChanged } from "firebase/auth"
import TurmasPage from "./pages/TurmasPage"
import PlanilhaPage from "./pages/PlanilhaPage"
import LoginPage from "./pages/LoginPage"

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [pagina, setPagina] = useState("turmas")
  const [turmaSel, setTurmaSel] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem("dark") === "true")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
    localStorage.setItem("dark", dark)
  }, [dark])

  const irPlanilha = (t) => { setTurmaSel(t); setPagina("planilha") }
  const voltar = () => setPagina("turmas")
  const handleLogout = () => signOut(auth)

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
        <p style={{ color: "#64748b", fontWeight: "500" }}>Carregando Diário...</p>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header className="app-header">
        <div className="header-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
            {pagina !== "turmas" && (
              <button onClick={voltar} className="btn-ghost" style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}>
                ← Voltar
              </button>
            )}
            <span style={{ fontWeight: "600", fontSize: "0.95rem" }}>Diário do Professor</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={() => setDark(!dark)}
              className="btn-ghost"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.9rem" }}
              title="Alternar tema"
            >
              {dark ? "☀️" : "🌙"}
            </button>
            <button
              onClick={handleLogout}
              className="btn-ghost"
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem", color: "#ef4444" }}
              title="Encerrar sessão"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "960px", margin: "0 auto", padding: "1rem" }}>
        {pagina === "turmas" && <TurmasPage onSelectTurma={irPlanilha} />}
        {pagina === "planilha" && <PlanilhaPage turma={turmaSel} />}
      </main>
    </div>
  )
}
