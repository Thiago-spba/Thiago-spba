import { useState, useEffect } from "react"
import { db } from "../firebase"
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore"

const CORES_HUM = ['#2563EB','#16A34A','#0891B2','#7C3AED','#DB2777','#0369A1']
const CORES_TEC = ['#E8540A','#9333EA','#D97706','#DC2626','#0F766E','#BE185D']

function CircleCard({ turma, color, onSelect, onDelete, animDelay }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{display:'flex',flexDirection:'column',alignItems:'center',
        animation:`popIn .4s ease ${animDelay}s both`}}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
    >
      <div
        onClick={()=>onSelect(turma)}
        style={{width:110,height:110,borderRadius:'50%',border:`4px solid ${color}`,
          background:'var(--bg-card)',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',cursor:'pointer',
          transform:hov?'scale(1.08)':'scale(1)',
          boxShadow:hov?`0 6px 24px ${color}44`:'none',
          transition:'transform .2s,box-shadow .2s',userSelect:'none'}}
      >
        <span style={{fontSize:20,fontWeight:700,color:'var(--text)',lineHeight:1.1,
          textAlign:'center',padding:'0 10px',wordBreak:'break-word'}}>{turma.nome}</span>
      </div>
      <div style={{textAlign:'center',marginTop:8,maxWidth:116}}>
        <p style={{fontSize:11,color:'var(--text-muted)',lineHeight:1.3,
          overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>
          {turma.disciplina}
        </p>
        <button
          onClick={e=>{e.stopPropagation();onDelete(turma.id)}}
          style={{fontSize:11,color:'#DC2626',background:'none',border:'none',cursor:'pointer',
            marginTop:4,opacity:hov?1:0,transition:'opacity .15s',display:'block',margin:'4px auto 0'}}
        >✕ remover</button>
      </div>
    </div>
  )
}

function Section({ title, icon, turmas, colors, onSelect, onDelete, onAdd }) {
  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1rem'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <span style={{fontSize:18}}>{icon}</span>
          <span style={{fontWeight:700,fontSize:'1rem',color:'var(--text)'}}>{title}</span>
          <span style={{fontSize:'0.8rem',color:'var(--text-muted)'}}>
            · {turmas.length} turma{turmas.length!==1?'s':''}
          </span>
        </div>
        <button
          onClick={onAdd}
          style={{width:34,height:34,borderRadius:'50%',background:'var(--accent)',color:'white',
            border:'none',fontSize:'1.5rem',cursor:'pointer',display:'flex',alignItems:'center',
            justifyContent:'center',flexShrink:0,transition:'transform .15s',
            boxShadow:'0 4px 12px rgba(232,84,10,0.3)'}}
          onMouseEnter={e=>e.currentTarget.style.transform='scale(1.12)'}
          onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}
          title={`Nova turma — ${title}`}
        >+</button>
      </div>
      {turmas.length===0
        ? <p style={{fontSize:'0.85rem',color:'var(--text-muted)',fontStyle:'italic',padding:'.5rem 0'}}>
            Nenhuma turma. Clique em + para adicionar.
          </p>
        : <div style={{display:'flex',flexWrap:'wrap',gap:16,paddingBottom:'0.5rem'}}>
            {turmas.map((t,i)=>(
              <CircleCard key={t.id} turma={t} color={colors[i%colors.length]}
                onSelect={onSelect} onDelete={onDelete} animDelay={i*0.07} />
            ))}
          </div>
      }
    </div>
  )
}

export default function TurmasPage({ onSelectTurma }) {
  const [turmas, setTurmas]         = useState([])
  const [nome, setNome]             = useState("")
  const [disciplina, setDisciplina] = useState("")
  const [tipo, setTipo]             = useState("basica")
  const [form, setForm]             = useState(false)

  useEffect(() => {
    return onSnapshot(collection(db,"turmas"), snap => {
      setTurmas(snap.docs.map(d => ({id:d.id,...d.data()})))
    })
  }, [])

  const adicionar = async () => {
    if (!nome.trim() || !disciplina.trim()) return
    await addDoc(collection(db,"turmas"), {nome:nome.trim(), disciplina:disciplina.trim(), tipo})
    setNome(""); setDisciplina(""); setTipo("basica"); setForm(false)
  }

  const remover = async (id) => {
    if (confirm("Remover essa turma?")) await deleteDoc(doc(db,"turmas",id))
  }

  const overlay = {position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:200,
    display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}
  const modal   = {background:"var(--bg-card)",borderRadius:16,padding:"1.5rem",maxWidth:380,width:"100%"}

  const turmasHum = turmas.filter(t => t.tipo !== "tecnica")
  const turmasTec = turmas.filter(t => t.tipo === "tecnica")

  return (
    <div style={{paddingTop:"1rem"}}>
      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.65)}to{opacity:1;transform:scale(1)}}`}</style>

      <div className="hero-card" style={{marginBottom:"1.5rem",display:'flex',alignItems:'center',gap:14}}>
        <div style={{width:46,height:46,borderRadius:'50%',background:'#E8540A',flexShrink:0,
          display:'flex',alignItems:'center',justifyContent:'center',
          color:'white',fontWeight:700,fontSize:15}}>TF</div>
        <div>
          <h1 style={{fontSize:"clamp(1rem,4vw,1.3rem)",fontWeight:800,
            margin:"0 0 0.2rem",color:"var(--text)"}}>Prof. Thiago Fernando</h1>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",fontStyle:"italic"}}>
            "A história explica de onde viemos; a tecnologia programa o seu futuro."
          </p>
        </div>
      </div>

      <Section
        title="Formação Básica Geral" icon="📚"
        turmas={turmasHum} colors={CORES_HUM}
        onSelect={onSelectTurma} onDelete={remover}
        onAdd={()=>{ setTipo("basica"); setForm(true) }}
      />

      <div style={{height:'1px',background:'var(--border)',margin:'1.75rem 0'}} />

      <Section
        title="Formação Técnica Profissional" icon="💻"
        turmas={turmasTec} colors={CORES_TEC}
        onSelect={onSelectTurma} onDelete={remover}
        onAdd={()=>{ setTipo("tecnica"); setForm(true) }}
      />

      {form && (
        <div style={overlay}>
          <div style={modal}>
            <h3 style={{fontWeight:700,color:"var(--text)",marginBottom:"1rem"}}>
              {tipo==="tecnica"
                ? "💻 Nova turma — Formação Técnica"
                : "📚 Nova turma — Formação Básica"}
            </h3>
            <input className="input-modern" value={nome}
              onChange={e=>setNome(e.target.value)}
              placeholder="Nome da turma (ex: 1 A)"
              style={{marginBottom:".75rem"}}
              onKeyDown={e=>e.key==="Enter"&&adicionar()} autoFocus />
            <input className="input-modern" value={disciplina}
              onChange={e=>setDisciplina(e.target.value)}
              placeholder="Disciplina (ex: História)"
              style={{marginBottom:"1rem"}}
              onKeyDown={e=>e.key==="Enter"&&adicionar()} />
            <div style={{display:"flex",gap:".5rem"}}>
              <button className="btn-primary" onClick={adicionar} style={{flex:1}}>Registrar</button>
              <button className="btn-ghost" onClick={()=>setForm(false)} style={{flex:1}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
