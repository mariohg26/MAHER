import { useState } from 'react'

const ROJO = '#c81019'

export default function Login({ onLogin, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [enviando, setEnviando] = useState(false)

  const submit = async () => {
    if (!email || !password) return
    setEnviando(true)
    await onLogin(email, password)
    setEnviando(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', padding: 20, fontFamily: "-apple-system, 'Segoe UI', sans-serif" }}>
      <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: '100%', maxWidth: 380, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 42, fontWeight: 900, color: ROJO, letterSpacing: -2 }}>MAHER</div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, letterSpacing: 1, marginTop: 4 }}>QUESOS MAHER SL</div>
        </div>

        {error && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: 12, borderRadius: 10, fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>EMAIL</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="tu@email.com"
          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
        />

        <label style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: 4 }}>CONTRASEÑA</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="••••••••"
          style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', marginBottom: 24, boxSizing: 'border-box' }}
        />

        <button
          onClick={submit}
          disabled={enviando}
          style={{ width: '100%', background: ROJO, color: '#fff', border: 'none', borderRadius: 10, padding: 14, fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: enviando ? 0.6 : 1 }}
        >
          {enviando ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </div>
    </div>
  )
}
