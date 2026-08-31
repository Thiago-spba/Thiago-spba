import fs from "fs";

// Lê o arquivo
let content = fs.readFileSync("src/pages/PlanilhaPage.jsx", "utf8");

// 1. Adiciona import do getDocs
content = content.replace(
  'import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where } from "firebase/firestore"',
  'import { collection, addDoc, deleteDoc, doc, updateDoc, onSnapshot, query, where, getDocs } from "firebase/firestore"'
);

// 2. Adiciona o estado carregando
content = content.replace(
  /const \[nome, setNome\]\s*=\s*useState\(""\)/,
  'const [nome, setNome] = useState("")\n  const [carregando, setCarregando] = useState(false)'
);

// 3. Adiciona a função limparTurmaToda ANTES de useEffect
const funcaoLimpar = `
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
`;

content = content.replace(
  /useEffect\(\(\) => {/,
  `${funcaoLimpar}\n\n  useEffect(() => {`
);

// 4. Adiciona o botão no final do return
const botaoHtml = `
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
          </button>`;

// Encontra o final do div de input e adiciona o botão
content = content.replace(
  /(<button className="parch-btn-primary" onClick=\{addAluno\}[\s\S]*?<\/button>)/,
  `$1\n        \n        ${botaoHtml}`
);

fs.writeFileSync("src/pages/PlanilhaPage.jsx", content, "utf8");
console.log("✅ Função de limpar turma adicionada com sucesso!");
