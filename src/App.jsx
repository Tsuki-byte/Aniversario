import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import {
  CheckCircle, XCircle, Loader2, AlertCircle,
  MapPin, Calendar, Clock, Car, Shirt, Phone, Eye
} from 'lucide-react'

function SectionTag({ num, label }) {
  return (
    <div className="section-tag">
      <div className="section-num">{String(num).padStart(2, '0')}</div>
      <span className="section-label">{label}</span>
    </div>
  )
}

export default function App() {
  // Guest state
  const [guestStatus, setGuestStatus] = useState('loading') // 'loading' | 'found' | 'notfound' | 'nocode'
  const [guestData,   setGuestData]   = useState(null)

  // RSVP form state
  const [attending,   setAttending]   = useState(null)
  const [companions,  setCompanions]  = useState(0)
  const [submitting,  setSubmitting]  = useState(false)
  const [formStep,    setFormStep]    = useState('form') // 'form' | 'success'
  const [error,       setError]       = useState('')

  // Manual code input (when no ?id in URL)
  const [manualCode,  setManualCode]  = useState('')
  const [codeError,   setCodeError]   = useState('')
  const [codeLoading, setCodeLoading] = useState(false)

  // Visit counter
  const [visitas, setVisitas] = useState(null)

  // ── On mount: track visit + load guest if ?id present ──────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const id = (params.get('id') || params.get('codigo') || '').toUpperCase()

    const trackAndLoad = async () => {
      if (!supabase) {
        // Database not configured
        setGuestStatus(id ? 'notfound' : 'nocode')
        return
      }

      // 1) Register visit
      try {
        await supabase.from('visitas_web').insert({ codigo_acceso: id || null })
      } catch (_) {}

      // 2) Get visit count
      try {
        const { count } = await supabase
          .from('visitas_web')
          .select('*', { count: 'exact', head: true })
        setVisitas(count)
      } catch (_) {}

      // 3) Load guest if code present
      if (!id) {
        setGuestStatus('nocode')
        return
      }

      try {
        const { data, error } = await supabase
          .from('invitados')
          .select('*')
          .eq('codigo_acceso', id)
          .single()

        if (error || !data) {
          setGuestStatus('notfound')
        } else {
          setGuestData(data)
          const estado = (data.estado_asistencia || '').toLowerCase()
          if (estado === 'confirmado') { setAttending(true);  setCompanions(data.conf_acompanantes || 0) }
          if (estado === 'declinado')  { setAttending(false) }
          // ✔ Si ya respondió una vez, bloquear el formulario
          if (estado === 'confirmado' || estado === 'declinado') {
            setFormStep('success')
          }
          
          setGuestStatus('found')
        }
      } catch (_) {
        setGuestStatus('notfound')
      }
    }

    trackAndLoad()
  }, [])

  // ── Manual code lookup ──────────────────────────────────────────────────
  const handleManualCode = async (e) => {
    e.preventDefault()
    const code = manualCode.trim().toUpperCase()
    if (!code) { setCodeError('Introduce tu código de invitación.'); return }
    setCodeLoading(true); setCodeError('')

    try {
      const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .eq('codigo_acceso', code)
        .single()

      if (error || !data) {
        setCodeError('Código no encontrado. Revisa tu invitación.')
      } else {
        setGuestData(data)
        const estado = (data.estado_asistencia || '').toLowerCase()
        if (estado === 'confirmado') { setAttending(true);  setCompanions(data.conf_acompanantes || 0) }
        if (estado === 'declinado')  { setAttending(false) }
        // ✔ Si ya respondió una vez, bloquear el formulario
        if (estado === 'confirmado' || estado === 'declinado') {
          setFormStep('success')
        }
        setGuestStatus('found')
      }
    } catch (_) {
      setCodeError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setCodeLoading(false)
    }
  }

  // ── RSVP submit ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (attending === null) { setError('Por favor, indica si podrás asistir.'); return }
    setSubmitting(true); setError('')

    try {
      if (!supabase) { setTimeout(() => { setFormStep('success'); setSubmitting(false) }, 800); return }

      const { error } = await supabase
        .from('invitados')
        .update({
          estado_asistencia: attending ? 'Confirmado' : 'Declinado',
          conf_titulares: attending ? 1 : 0,
          conf_acompanantes: attending ? parseInt(companions) : 0
        })
        .eq('id', guestData.id)

      if (error) throw error
      setFormStep('success')
    } catch (_) {
      setError('No pudimos guardar tu respuesta. Por favor, inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Full page layout (always shown) ─────────────────────────────────────
  const MainPage = () => (
    <div className="page">

      {/* ── HERO ── */}
      <section className="hero">
        <SectionTag num={1} label="Nuestro Legado" />
        <h1 className="hero-title">
          Setenta y cinco años merecen algo más que una celebración.
        </h1>
        <p className="hero-body">
          Este aniversario es un homenaje a quienes han formado parte del camino de Embutidos Bernal:
          a la experiencia transmitida, al oficio y a la confianza compartida.
        </p>
        <p className="hero-body">
          Te invitamos a vivir una jornada en dos actos. Primero miraremos atrás con orgullo.
          Después brindaremos juntos por el futuro.
        </p>
        <div className="hero-timeline">
          <span className="timeline-year">1951</span>
          <div className="timeline-center">75 años</div>
          <span className="timeline-year">2026</span>
        </div>
      </section>

      {/* ── ACTO I ── */}
      <section className="section-dark">
        <SectionTag num={2} label="Acto I" />
        <p className="card-label" style={{ marginBottom: 12 }}>NUESTRA HISTORIA</p>
        <h2 className="section-dark-title">El lugar donde la memoria cobra vida.</h2>
        <p className="section-dark-body">
          La primera parte del encuentro estará dedicada a recorrer la trayectoria de Embutidos Bernal,
          recordar sus principales hitos y reconocer a quienes la han hecho posible.
        </p>
        <div className="location-block">
          <div className="location-name"><MapPin size={16} /> Facultad de Veterinaria</div>
          <div className="location-sub">Universidad de Zaragoza</div>
          <a href="https://maps.google.com/?q=Facultad+de+Veterinaria+Universidad+de+Zaragoza"
            target="_blank" rel="noopener noreferrer" className="location-maps">
            ABRIR EN GOOGLE MAPS →
          </a>
        </div>
        <div className="card-dark">
          <p className="card-label">EXPOSICIÓN ESPECIAL</p>
          <h3 className="card-title">Museo Bernal</h3>
          <p className="card-body">
            Máquinas, fotografías y objetos que han acompañado la evolución de la fábrica
            se reunirán por primera vez para contar una historia hecha de trabajo, ingenio y tiempo.
          </p>
          <p className="card-italic">Una mirada al oficio que nos trajo hasta aquí.</p>
        </div>
      </section>

      {/* ── Transition ── */}
      <div className="transition-band">
        <p className="transition-text">De la historia</p>
        <div className="transition-arrow">
          <div className="arrow-line" />
          <span>Universidad de Zaragoza → Torreluna</span>
          <div className="arrow-line" />
        </div>
        <p className="transition-text" style={{ marginTop: 12 }}>a una noche para celebrarla</p>
      </div>

      {/* ── ACTO II ── */}
      <section className="section-dark">
        <SectionTag num={3} label="Acto II" />
        <p className="card-label" style={{ marginBottom: 12 }}>LA CELEBRACIÓN</p>
        <h2 className="section-dark-title">Brindemos por todo lo vivido.</h2>
        <p className="section-dark-body">
          Al caer la tarde, la celebración continúa en Torreluna. Cóctel, gastronomía,
          música en directo y una noche pensada para disfrutar juntos.
        </p>
        <div className="location-block">
          <div className="location-name"><MapPin size={16} /> Torreluna</div>
          <div className="location-sub">Zaragoza</div>
          <a href="https://maps.google.com/?q=Torreluna+Zaragoza"
            target="_blank" rel="noopener noreferrer" className="location-maps">
            ABRIR EN GOOGLE MAPS →
          </a>
        </div>
      </section>

      {/* ── Quote ── */}
      <div className="quote-block">
        <p className="quote-text">"Y algunas cosas que preferimos no contar todavía..."</p>
        <span className="quote-icon">✦</span>
      </div>

      {/* ── Info Grid ── */}
      <section className="info-section">
        <h2 className="info-heading">Lo que necesitas saber.</h2>
        <div className="info-grid">
          <div className="info-cell">
            <Calendar size={20} className="info-cell-icon" />
            <div className="info-cell-label">Fecha</div>
            <div className="info-cell-value">Por confirmar</div>
          </div>
          <div className="info-cell">
            <Clock size={20} className="info-cell-icon" />
            <div className="info-cell-label">Hora de llegada</div>
            <div className="info-cell-value">Por confirmar</div>
          </div>
          <div className="info-cell">
            <Car size={20} className="info-cell-icon" />
            <div className="info-cell-label">Aparcamiento</div>
            <div className="info-cell-value">Por confirmar</div>
          </div>
          <div className="info-cell">
            <Shirt size={20} className="info-cell-icon" />
            <div className="info-cell-label">Dress Code</div>
            <div className="info-cell-value">Por confirmar</div>
          </div>
          <div className="info-cell info-cell-wide">
            <Phone size={20} className="info-cell-icon" />
            <div className="info-cell-label">Contacto</div>
            <div className="info-cell-value">976 33 22 29</div>
          </div>
        </div>
      </section>

      {/* ── RSVP Section ── */}
      <section className="rsvp-section" id="confirmar">
        {guestStatus === 'loading' && (
          <div className="rsvp-loading">
            <Loader2 className="spin" size={24} />
            <span>Cargando tu invitación...</span>
          </div>
        )}

        {/* Guest found → full personalized form */}
        {guestStatus === 'found' && formStep === 'form' && (
          <>
            <h2 className="rsvp-title">Confirma tu asistencia</h2>
            <p className="rsvp-subtitle">Tu respuesta nos ayuda a preparar una celebración a la altura.</p>
            <div className="rsvp-greeting">¡Hola, {guestData?.nombre}!</div>
            <p className="rsvp-greeting-sub">
              {guestData?.estado_asistencia && !['pendiente',''].includes((guestData.estado_asistencia||'').toLowerCase())
                ? 'Ya has respondido anteriormente. Puedes actualizar tu confirmación.'
                : 'Nos encantaría contar contigo en este día tan especial.'}
            </p>
            <div className="divider" />
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">¿Podrás acompañarnos?</label>
                <div className="radio-group">
                  <div className="radio-option">
                    <input type="radio" id="yes" name="attending"
                      checked={attending === true} onChange={() => setAttending(true)} />
                    <label htmlFor="yes"><CheckCircle size={22} />Sí, asistiré</label>
                  </div>
                  <div className="radio-option">
                    <input type="radio" id="no" name="attending"
                      checked={attending === false}
                      onChange={() => { setAttending(false); setCompanions(0) }} />
                    <label htmlFor="no"><XCircle size={22} />No podré ir</label>
                  </div>
                </div>
              </div>
              {attending && (
                <div className="form-group" style={{ animation: 'slideUp 0.3s ease-out' }}>
                  <label className="form-label">Acompañantes (adicionales a ti)</label>
                  <div className="companions-row">
                    <button type="button" className="btn-counter"
                      onClick={() => setCompanions(Math.max(0, companions - 1))}>−</button>
                    <input className="companions-number" type="number" value={companions} readOnly />
                    <button type="button" className="btn-counter"
                      onClick={() => setCompanions(Math.min(10, companions + 1))}>+</button>
                  </div>
                  <p className="companions-hint">Total de personas: <strong>{parseInt(companions) + 1}</strong></p>
                </div>
              )}
              {error && <div className="error-msg"><AlertCircle size={15} />{error}</div>}
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? <><Loader2 size={16} className="spin" /> Guardando...</> : 
                  (attending === false ? 'CONFIRMAR DECLINACIÓN' : 'CONFIRMAR ASISTENCIA')}
              </button>
              <p className="privacy-text">Tus datos se enviarán y almacenarán de forma segura.</p>
            </form>
          </>
        )}

        {/* RSVP success */}
        {guestStatus === 'found' && formStep === 'success' && (
          <div className="rsvp-success">
            {attending
              ? <><CheckCircle size={48} className="rsvp-success-icon" />
                  <h2 className="rsvp-title">¡Perfecto, te esperamos!</h2>
                  <p className="rsvp-subtitle">
                    Hemos registrado tu asistencia.
                    {companions > 0 && <> Vendéis <strong>{parseInt(companions) + 1} personas</strong> en total.</>}
                    {' '}¡Nos vemos en la celebración!
                  </p>
                  <p className="rsvp-locked-note">🔒 Tu respuesta ya ha sido registrada y no puede modificarse. Si necesitas hacer un cambio contacta con nosotros. </p></>
              : <><XCircle size={48} className="rsvp-success-icon muted" />
                  <h2 className="rsvp-title">Respuesta registrada</h2>
                  <p className="rsvp-subtitle">Lamentamos que no puedas venir. ¡Te echaremos de menos!</p>
                  <p className="rsvp-locked-note">🔒 Tu respuesta ya ha sido registrada y no puede modificarse. Si necesitas hacer un cambio contacta con nosotros.</p></>
            }
          </div>
        )}

        {/* Code not found */}
        {guestStatus === 'notfound' && (
          <>
            <h2 className="rsvp-title">Confirma tu asistencia</h2>
            <div className="code-error-block">
              <AlertCircle size={20} />
              <p>El código de tu enlace no se ha encontrado. Introdúcelo manualmente:</p>
            </div>
            <ManualCodeForm
              code={manualCode} setCode={setManualCode}
              onSubmit={handleManualCode} loading={codeLoading} codeError={codeError}
            />
          </>
        )}

        {/* No code in URL → show manual input */}
        {guestStatus === 'nocode' && (
          <>
            <h2 className="rsvp-title">Confirma tu asistencia</h2>
            <p className="rsvp-subtitle">
              Si tienes una invitación, introduce aquí tu código personal para confirmar tu asistencia.
            </p>
            <ManualCodeForm
              code={manualCode} setCode={setManualCode}
              onSubmit={handleManualCode} loading={codeLoading} codeError={codeError}
            />
          </>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-75">75</div>
        <div className="footer-logo">B</div>
        <p className="footer-tagline">75 años de historia.</p>
        <p className="footer-tagline-gold">Y todavía nos queda mucho por celebrar.</p>
        <div className="footer-contacts">
          <span>@ @embutidosbernal</span>
          <span>☏ 976 33 22 29</span>
        </div>
        {visitas !== null && (
          <div className="visit-counter">
            <Eye size={13} />
            {visitas.toLocaleString('es-ES')} visitas
          </div>
        )}
        <p className="footer-brand" style={{ marginTop: 16 }}>Embutidos Bernal · 1951 — 2026</p>
      </footer>
    </div>
  )

  // While loading, show a minimal splash so page doesn't jump
  return <MainPage />
}

// ── Manual code form (extracted for reuse) ────────────────────────────────────
function ManualCodeForm({ code, setCode, onSubmit, loading, codeError }) {
  return (
    <form onSubmit={onSubmit} style={{ marginTop: 24 }}>
      <div className="form-group">
        <label className="form-label">Código de invitación</label>
        <input
          type="text"
          className="code-input"
          placeholder="Ej. 521C8B68"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          maxLength={16}
          autoCapitalize="characters"
        />
      </div>
      {codeError && <div className="error-msg"><AlertCircle size={15} />{codeError}</div>}
      <button type="submit" className="btn-primary" disabled={loading}>
        {loading ? <><Loader2 size={16} className="spin" /> Buscando...</> : 'ACCEDER A MI INVITACIÓN'}
      </button>
    </form>
  )
}
