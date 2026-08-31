import { useState, useEffect } from "react"
import { db } from "../firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"

export default function useConfig() {
  const [config, setConfig] = useState({escola:""})
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    getDoc(doc(db,"config","professor")).then(d => {
      if (d.exists()) setConfig(d.data())
      setCarregando(false)
    })
  }, [])

  const salvarConfig = async (novaConfig) => {
    await setDoc(doc(db,"config","professor"), novaConfig)
    setConfig(novaConfig)
  }

  return { config, salvarConfig, carregando }
}