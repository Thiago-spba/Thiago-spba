import { useState, useEffect } from "react"
import { auth, signOut } from "./firebase"
import { onAuthStateChanged } from "firebase/auth"
import TurmasPage from "./pages/TurmasPage"
import PlanilhaPage from "./pages/PlanilhaPage"
import LoginPage from "./pages/LoginPage"

// Lista de e-mails autorizados (acesso exclusivo)
const EMAILS_AUTORIZADOS = ["thiago.rpba@gmail.com"]

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [acessoNegado, setAcessoNegado] = useState(false)
  const [emailTentativa, setEmailTentativa] = useState("")
  const [pagina, setPagina] = useState("turmas")
  const [turmaSel, setTurmaSel] = useState(null)
  const [dark, setDark] = useState(() => localStorage.getItem("dark") === "true")

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (EMAILS_AUTORIZADOS.includes(currentUser.email)) {
          setUser(currentUser)
          setAcessoNegado(false)
        } else {
          setEmailTentativa(currentUser.email || "")
          setAcessoNegado(true)
          signOut(auth)
          setUser(null)
        }
      } else {
        setUser(null)
      }
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

  if (acessoNegado) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "1rem" }}>
        <div style={{ maxWidth: "420px", width: "100%", background: "#ffffff", padding: "2rem", borderRadius: "16px", textAlign: "center", border: "1px solid #fee2e2", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>🚫</div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: "700", color: "#b91c1c", marginBottom: "0.5rem" }}>Acesso Não Autorizado</h2>
          <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1.5rem" }}>
            A conta <strong>{emailTentativa}</strong> não tem permissão para acessar este diário. Este aplicativo é de uso exclusivo do Professor.
          </p>
          <button onClick={() => setAcessoNegado(false)} style={{ background: "#0f172a", color: "#ffffff", padding: "0.75rem 1.5rem", borderRadius: "8px", border: "none", fontWeight: "600", cursor: "pointer" }}>
            Tentar com outra conta
          </button>
        </div>
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
