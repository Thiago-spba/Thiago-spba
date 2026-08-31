import { useState } from "react";
import { auth, googleProvider, signInWithPopup } from "../firebase";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const handleLogin = async () => {
    setLoading(true);
    setErro("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setErro("Falha ao autenticar com o Google. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg, #f8fafc)",
      padding: "1rem"
    }}>
      <div style={{
        maxWidth: "400px",
        width: "100%",
        background: "#ffffff",
        padding: "2.5rem 2rem",
        borderRadius: "16px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
        textAlign: "center",
        border: "1px solid #e2e8f0"
      }}>
        <img src="/favicon.svg" alt="Logo" style={{ width: "64px", height: "64px", margin: "0 auto 1.5rem" }} />
        
        <h1 style={{ fontSize: "1.5rem", fontWeight: "700", color: "#1e293b", marginBottom: "0.5rem" }}>
          Diário do Professor
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "2rem" }}>
          Acesso restrito para gestão pedagógica e notas.
        </p>

        {erro && (
          <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "0.75rem", borderRadius: "8px", fontSize: "0.85rem", marginBottom: "1rem" }}>
            {erro}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.75rem",
            background: "#0f172a",
            color: "#ffffff",
            padding: "0.85rem",
            borderRadius: "10px",
            fontWeight: "600",
            fontSize: "0.95rem",
            cursor: loading ? "not-allowed" : "pointer",
            border: "none",
            transition: "opacity 0.2s"
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.1 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8 0-1.3.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.1-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
          </svg>
          {loading ? "Entrando..." : "Entrar com Google"}
        </button>
      </div>
    </div>
  );
}
