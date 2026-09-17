import { useState } from 'react'
import { supabase } from './supabaseClient'
import { CheckCircle, Search } from 'lucide-react'

function App() {
  const [step, setStep] = useState('login') // 'login', 'form', 'success'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Extraer código de la URL si existe (ej: ?codigo=MIPRUEBA)
  const [inviteCode, setInviteCode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('codigo') || '').toUpperCase();
  })
  
  const [guestData, setGuestData] = useState(null)
  
  // Form state
  const [attending, setAttending] = useState(null)
  const [companions, setCompanions] = useState(0)

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!inviteCode.trim()) {
      setError('Por favor, introduce tu código.')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      // Simulate if no supabase connected yet
      if (!supabase) {
        console.log('Modo Demo sin Supabase conectado.')
        setTimeout(() => {
          setGuestData({ id: '1', nombre: 'Familia Invitada de Prueba' })
          setStep('form')
          setLoading(false)
        }, 1000)
        return
      }

      const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .eq('codigo', inviteCode.toUpperCase())
        .single()

      if (error || !data) {
        setError('Código no encontrado. Por favor, revisa tu invitación.')
      } else {
        setGuestData(data)
        if (data.estado_asistencia === 'confirmado' || data.estado_asistencia === 'declinado') {
           // If already responded
           setAttending(data.estado_asistencia === 'confirmado')
           setCompanions(data.acompanantes_confirmados || 0)
        }
        setStep('form')
      }
    } catch (err) {
      setError('Ocurrió un error. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (attending === null) {
      setError('Por favor, confirma si podrás asistir.')
      return
    }

    setLoading(true)
    setError('')

    try {
      if (!supabase) {
        setTimeout(() => {
          setStep('success')
          setLoading(false)
        }, 1000)
        return
      }

      const { error } = await supabase
        .from('invitados')
        .update({
          estado_asistencia: attending ? 'confirmado' : 'declinado',
          acompanantes_confirmados: attending ? parseInt(companions) : 0
        })
        .eq('id', guestData.id)

      if (error) throw error

      setStep('success')
    } catch (err) {
      setError('No pudimos guardar tu confirmación. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="glass-card">
      <h1 className="title">50º Aniversario</h1>
      
      {step === 'login' && (
        <form onSubmit={handleLogin}>
          <div className="subtitle text-center" style={{textAlign: 'center', color: '#eee'}}>
            Por favor, introduce el código de invitación que recibiste para confirmar tu asistencia.
          </div>
          <div className="form-group">
            <input 
              type="text" 
              placeholder="Código de Invitación (ej. PEREZ2026)" 
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Buscando...' : 'Acceder'}
          </button>
        </form>
      )}

      {step === 'form' && (
        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: 'center', marginBottom: '25px', color: '#fff' }}>
            <h2>¡Hola, {guestData?.nombre}!</h2>
            <p style={{ marginTop: '10px', color: '#ccc' }}>Esperamos contar contigo en este día tan especial.</p>
          </div>

          <div className="form-group">
            <label>¿Podrás asistir?</label>
            <div className="radio-group">
              <div className="radio-option">
                <input 
                  type="radio" 
                  id="attending-yes" 
                  name="attending" 
                  checked={attending === true}
                  onChange={() => setAttending(true)}
                />
                <label htmlFor="attending-yes">Sí, asistiré</label>
              </div>
              <div className="radio-option">
                <input 
                  type="radio" 
                  id="attending-no" 
                  name="attending" 
                  checked={attending === false}
                  onChange={() => {
                    setAttending(false);
                    setCompanions(0);
                  }}
                />
                <label htmlFor="attending-no">No podré ir</label>
              </div>
            </div>
          </div>

          {attending && (
            <div className="form-group" style={{ animation: 'fadeIn 0.3s' }}>
              <label>Número de acompañantes (adicionales a ti)</label>
              <input 
                type="number" 
                min="0" 
                max="10" 
                value={companions}
                onChange={(e) => setCompanions(e.target.value)}
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Guardando...' : 'Confirmar Asistencia'}
          </button>
        </form>
      )}

      {step === 'success' && (
        <div className="success-container">
          <CheckCircle className="success-icon" size={64} style={{ display: 'inline-block' }} />
          <h2>¡Gracias por confirmar!</h2>
          <p className="subtitle" style={{ marginTop: '15px' }}>
            {attending 
              ? "Hemos registrado tu asistencia. ¡Nos vemos en la fiesta!" 
              : "Lamentamos que no puedas venir. ¡Te echaremos de menos!"}
          </p>
        </div>
      )}
    </div>
  )
}

export default App
