// Sistema compartilhado de avisos do app: substitui os alert()/confirm()
// padrão (feios) do navegador por um toast e um modal de confirmação no
// mesmo estilo visual do resto do app. Usado por qualquer página via o hook
// useAviso() — só precisa estar dentro do <AvisoProvider> (montado uma vez
// em App.jsx).

import { createContext, useContext, useState, useRef, useCallback } from "react"

const AvisoContext = createContext(null)

const CORES_TIPO = {
  erro: "#DC2626",
  sucesso: "#16A34A",
  info: "#7C3AED",
}

const ICONES_TIPO = {
  erro: "⚠️",
  sucesso: "✅",
  info: "ℹ️",
}

export function AvisoProvider({ children }) {
  const [toast, setToast] = useState(null) // {tipo, texto}
  const toastTimeoutRef = useRef(null)

  const [confirmacao, setConfirmacao] = useState(null) // {titulo, mensagem, resolver, perigo}

  const mostrarToast = useCallback((tipo, texto) => {
    clearTimeout(toastTimeoutRef.current)
    setToast({ tipo, texto })
    toastTimeoutRef.current = setTimeout(() => setToast(null), 5000)
  }, [])

  // Retorna uma Promise<boolean> — true se o professor confirmou.
  // Uso: if (await confirmar("Remover essa turma?")) { ... }
  const confirmar = useCallback((mensagem, opcoes = {}) => {
    return new Promise((resolver) => {
      setConfirmacao({ mensagem, titulo: opcoes.titulo || "Confirmar ação", perigo: opcoes.perigo !== false, resolver })
    })
  }, [])

  const responderConfirmacao = (resposta) => {
    confirmacao?.resolver(resposta)
    setConfirmacao(null)
  }

  return (
    <AvisoContext.Provider value={{ mostrarToast, confirmar }}>
      {children}

      <style>{`
        @keyframes entrarToast { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
        @keyframes entrarModalAviso { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>

      {/* Toast — avisos rápidos, some sozinho */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "1.25rem", left: "50%", transform: "translateX(-50%)",
          zIndex: 2000, maxWidth: "min(90vw, 420px)", display: "flex", alignItems: "flex-start", gap: "0.6rem",
          background: "var(--bg-card)", color: "var(--text)", padding: "0.8rem 1rem", borderRadius: "12px",
          boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
          borderLeft: `4px solid ${CORES_TIPO[toast.tipo] || CORES_TIPO.info}`,
          animation: "entrarToast 0.2s ease-out",
        }}>
          <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{ICONES_TIPO[toast.tipo] || ICONES_TIPO.info}</span>
          <p style={{ fontSize: "0.85rem", lineHeight: 1.4, flex: 1 }}>{toast.texto}</p>
          <button onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "0.9rem", flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* Modal de confirmação — substitui o confirm() padrão */}
      {confirmacao && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 2100, background: "rgba(15,23,42,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={() => responderConfirmacao(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "var(--bg-card)", color: "var(--text)", borderRadius: "16px",
            padding: "1.5rem", maxWidth: "380px", width: "100%",
            boxShadow: "0 20px 45px rgba(0,0,0,0.3)",
            borderTop: `4px solid ${confirmacao.perigo ? CORES_TIPO.erro : CORES_TIPO.info}`,
            animation: "entrarModalAviso 0.15s ease-out",
          }}>
            <p style={{ fontWeight: "700", fontSize: "1rem", marginBottom: "0.5rem" }}>
              {confirmacao.perigo ? "⚠️ " : ""}{confirmacao.titulo}
            </p>
            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "1.25rem" }}>
              {confirmacao.mensagem}
            </p>
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => responderConfirmacao(false)}>Cancelar</button>
              <button onClick={() => responderConfirmacao(true)} style={{
                background: confirmacao.perigo ? CORES_TIPO.erro : "var(--accent)", color: "white",
                border: "none", borderRadius: "8px", padding: "0.5rem 1.1rem", fontWeight: "700", cursor: "pointer",
              }}>
                {confirmacao.perigo ? "Remover" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AvisoContext.Provider>
  )
}

export function useAviso() {
  const ctx = useContext(AvisoContext)
  if (!ctx) throw new Error("useAviso() precisa ser usado dentro de <AvisoProvider>")
  return ctx
}
