import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import {
  CheckCircle, XCircle, Loader2, AlertCircle,
  MapPin, Calendar, Clock, Car, Shirt, Phone, Eye, ArrowRight, ArrowDown, Sparkles, UsersRound
} from 'lucide-react'

const Countdown = () => {
  const targetDate = new Date("2026-11-10T17:00:00").getTime();
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 60000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div className="countdown-container">
      <span className="countdown-label">FALTAN</span>
      <div className="countdown-values">
        <div className="countdown-item">
          <strong>{timeLeft.days.toString().padStart(2, '0')}</strong>
          <small>DÍAS</small>
        </div>
        <div className="countdown-item">
          <strong>{timeLeft.hours.toString().padStart(2, '0')}</strong>
          <small>HORAS</small>
        </div>
        <div className="countdown-item">
          <strong>{timeLeft.minutes.toString().padStart(2, '0')}</strong>
          <small>MINUTOS</small>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // Guest state
  const [guestStatus, setGuestStatus] = useState('loading') // 'loading' | 'found' | 'notfound' | 'nocode'
  const [guestData,   setGuestData]   = useState(null)

  // RSVP form state
  const [attending,   setAttending]   = useState(null)
  const [companions,  setCompanions]  = useState(0)
  const [nombreTitular, setNombreTitular] = useState('')
  const [nombreAcompanante, setNombreAcompanante] = useState('')
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
          if (estado === 'confirmado') { 
            setAttending(true);  
            setCompanions(data.conf_acompanantes || 0);
            setNombreTitular(data.nombre_titular || '');
            setNombreAcompanante(data.nombre_acompanante || '');
          }
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
    if (!code) return
    setCodeError('')
    setCodeLoading(true)

    try {
      const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .eq('codigo_acceso', code)
        .single()

      if (error || !data) {
        setCodeError('El código no es válido o no se encuentra.')
      } else {
        setGuestData(data)
        const estado = (data.estado_asistencia || '').toLowerCase()
        if (estado === 'confirmado') { 
          setAttending(true);  
          setCompanions(data.conf_acompanantes || 0);
          setNombreTitular(data.nombre_titular || '');
          setNombreAcompanante(data.nombre_acompanante || '');
        }
        if (estado === 'declinado')  { setAttending(false) }
        if (estado === 'confirmado' || estado === 'declinado') {
          setFormStep('success')
        }
        setGuestStatus('found')
        
        // Update URL so it stays on refresh
        const url = new URL(window.location)
        url.searchParams.set('id', code)
        window.history.pushState({}, '', url)
      }
    } catch (_) {
      setCodeError('Error al buscar el código. Inténtalo de nuevo.')
    } finally {
      setCodeLoading(false)
    }
  }

  // ── Handle RSVP Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (attending === null) {
      setError('Por favor, indica si podrás asistir o no.')
      return
    }
    
    if (attending) {
      if (!nombreTitular.trim()) {
        setError('Por favor, indica tu nombre y apellidos.')
        return
      }
      if (companions === 1 && !nombreAcompanante.trim()) {
        setError('Por favor, indica el nombre y apellidos de tu acompañante.')
        return
      }
    }

    setSubmitting(true)
    setError('')

    try {
      if (!supabase) {
        // Demo success
        setTimeout(() => setFormStep('success'), 1000)
        return
      }

      const { data, error } = await supabase
        .from('invitados')
        .update({
          estado_asistencia: attending ? 'Confirmado' : 'Declinado',
          conf_titulares: attending ? 1 : 0,
          conf_acompanantes: attending ? parseInt(companions) : 0,
          necesita_parking: false,
          nombre_titular: attending ? nombreTitular.trim() : null,
          nombre_acompanante: (attending && companions === 1) ? nombreAcompanante.trim() : null,
          fecha_respuesta: new Date().toISOString(),
          observaciones: (guestData.observaciones || '') + ' - [Respondido vía web]'
        })
        .eq('id', guestData.id)
        .select()

      if (error) throw error
      if (!data || data.length === 0) throw new Error('El registro no se actualizó en la base de datos.')
      
      setFormStep('success')
    } catch (_) {
      setError('No pudimos guardar tu respuesta. Por favor, inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleNavClick = (e, targetId) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (!target) return;
    
    const targetPosition = target.getBoundingClientRect().top + window.scrollY;
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    const duration = 2500; // 2.5 segundos para un scroll lentísimo y panorámico
    let start = null;

    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = timestamp - start;
      const t = Math.min(progress / duration, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      window.scrollTo(0, startPosition + distance * ease);
      
      if (progress < duration) {
        window.requestAnimationFrame(step);
      } else {
        window.location.hash = targetId;
      }
    };
    window.requestAnimationFrame(step);
  };

  // ── Full page layout (always shown) ─────────────────────────────────────
  return (
    <main>
      <header className="nav" aria-label="Navegación principal">
        <a className="wordmark brand-lockup" href="#inicio" onClick={(e) => handleNavClick(e, 'inicio')} aria-label="Embutidos Bernal, inicio">
          <span className="brand-logo old-brand-logo">
            <img src="./anagrama-bernal-transparente.png" alt="Anagrama de Embutidos Bernal"/>
          </span>
          <strong className="brand-name"><b>Embutidos</b><b>Bernal</b></strong>
        </a>
        <nav style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          <a href="#historia" onClick={(e) => handleNavClick(e, 'historia')}>Historia</a>
          <a href="#programa" onClick={(e) => handleNavClick(e, 'programa')}>Programa</a>
          <a href="#confirmacion" onClick={(e) => handleNavClick(e, 'confirmacion')}>Confirmar</a>
        </nav>
      </header>

      <section id="inicio" className="hero" aria-labelledby="hero-title">
        <img src="./salchichas-bernal-portada.jpeg" alt="Selección de salchichas de Embutidos Bernal" />
        <div className="hero-shade"></div>
        <div className="hero-content">
          <p className="eyebrow">Embutidos Bernal · Invitación</p>
          <div className="anniversary-mark" aria-hidden="true"><span>7</span><span>5</span></div>
          <h1 id="hero-title"><span>75 aniversario</span>Una historia<br/>que celebrar</h1>
          <p className="hero-copy">Nos hará mucha ilusión compartir contigo un día irrepetible: el encuentro entre nuestra memoria y todo lo que está por venir.</p>
          <div className="hero-meta">
            <span><Calendar size={24} aria-hidden="true" />10 de noviembre de 2026</span>
            <span><Clock size={24} aria-hidden="true" />Desde las 17:00 h</span>
            <span><MapPin size={24} aria-hidden="true" />Zaragoza</span>
          </div>
          
          <Countdown />

        </div>
        <p className="vertical-note">Tradición · Familia · Futuro</p>
      </section>

      <section className="intro section" id="historia">
        <div className="section-label"><span>01</span> Nuestro legado</div>
        <div className="intro-grid">
          <h2>Setenta y cinco años merecen algo más que una celebración.</h2>
          <div>
            <p>Celebramos 75 años de historia, tres generaciones y el compromiso de una empresa familiar aragonesa que ha crecido junto a sus clientes, trabajadores, proveedores, colaboradores e instituciones públicas y privadas.</p>

          </div>
        </div>
        <div className="years">
          <div className="year-point">
            <span>1951</span>
            <img src="./firma-bernal.png" alt="Firma histórica de Embutidos Bernal" style={{ marginTop: '3.5rem', width: '180px', objectFit: 'contain' }} />
          </div>
          <i></i>
          <div className="year-point">
            <span>&nbsp;</span>
            <img src="./logo-bernal-blanco.jpg" alt="Logotipo histórico de Embutidos Bernal" style={{ marginTop: '2.5rem', mixBlendMode: 'darken', transform: 'translateY(8.9%) scale(1.47)' }} />
          </div>
          <i></i>
          <div className="year-point">
            <span style={{ color: 'var(--wine)', fontWeight: 'bold' }}>75 años</span>
            <img src="./logo-bernal-negro.jpg" alt="Logo conmemorativo 75 años" style={{ marginTop: '2.5rem' }} />
          </div>
          <i></i>
          <div className="year-point">
            <span>2026</span>
            <img src="./logo-bernal-2026.png" alt="Logotipo actual de Embutidos Bernal" style={{ marginTop: '-1.5rem', width: '305px', height: 'auto', transform: 'translateX(-23%)' }} />
          </div>
        </div>
      </section>

      <section className="act act-one section">
        <div className="section-label light"><span>02</span> Exposición histórica</div>
        <div className="act-grid">
          <div>
            <h2>El lugar donde<br/>la memoria cobra vida.</h2>
            <p>A partir del día 26 de octubre y, previsiblemente, hasta finales de noviembre, el hall de la Facultad de Veterinaria acogerá una exposición dedicada a la historia de Embutidos Bernal.</p>
            <div className="location">
              <MapPin size={24} aria-hidden="true" />
              <div>
                <strong>Hall de la Facultad de Veterinaria</strong>
                <span>Universidad de Zaragoza</span>
                <a className="map-link" href="https://maps.app.goo.gl/6KESW6yhABA5VNUbA?g_st=ic" target="_blank" rel="noreferrer">
                  Abrir en Google Maps <ArrowRight size={24} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
          <div className="museum-card">
            <img className="museum-photo" src="./museo-bernal-historica-remastered.jpeg" alt="Fotografía histórica de la familia Bernal junto al antiguo carro de reparto"/>
            <span className="card-number">75</span>
            <div>
              <h3>Museo Bernal</h3>
              <p>Una muestra de la maquinaria original utilizada por nuestros antecesores a mediados del siglo XX, acompañada de un recorrido audiovisual por nuestra historia.</p>
              <p style={{ marginTop: '0.5rem' }}>La exposición también mira hacia el mañana: innovación, nuevos productos y un espacio de divulgación con investigaciones científicas que respaldan el papel fundamental de los productos cárnicos dentro de una dieta equilibrada.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="journey" aria-label="Transición entre localizaciones">
        <p>De la historia</p>
        <div>
          <span>Universidad de Zaragoza</span><i></i>
          <ArrowRight size={24} aria-hidden="true" /><i></i>
          <span>Torreluna</span>
        </div>
        <p>a una noche para celebrarla</p>
      </section>

      <section className="act act-two section">
        <div className="section-label light"><span>03</span> Gran celebración del 75.º aniversario</div>
        <div className="celebration-layout">
          <div>
            <h2>Brindemos por todo lo vivido.</h2>
            <p>El 10 de noviembre reuniremos en Zaragoza a profesionales del canal HORECA y de alimentación de toda España, además de autoridades y amigos. La jornada, que incluirá una exposición en la Facultad de Veterinaria, continuará a partir de las 18:00 h con una gran celebración en los salones de la finca Torreluna. Será una tarde-noche para encontrarnos, recordar nuestra historia y celebrar juntos el futuro, sirviendo como sincero reconocimiento a todas las personas que hacen posible nuestro sector.</p>
            <div className="location">
              <MapPin size={24} aria-hidden="true" />
              <div>
                <strong>Finca Torreluna</strong>
                <span>Miguel Servet, 193 · Zaragoza</span>
                <a className="map-link" href="https://maps.app.goo.gl/jver8wG8urWqLjdk8?g_st=ic" target="_blank" rel="noreferrer">
                  Abrir en Google Maps <ArrowRight size={24} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
          <blockquote>
            “Una noche para celebrar con todas las personas que han hecho posible este camino y brindar por el esfuerzo, el sacrificio y la dedicación que siguen construyendo nuestra historia.” 
            <Sparkles size={24} aria-hidden="true" />
          </blockquote>
        </div>
      </section>

      <section className="anniversary-logo-break" aria-label="75.º aniversario de Embutidos Bernal">
        <small>1951 — 2026</small>
        <div className="anniversary-logo-composite">
          <img className="anniversary-logo-base" src="./logo-75-embutidos-bernal.png" alt="Logotipo del 75.º aniversario de Embutidos Bernal"/>
          <span className="anniversary-logo-emblem" aria-hidden="true">
            <img src="./anagrama-bernal-transparente.png" alt=""/>
          </span>
        </div>
        <p>75 años de historia. Una mirada hacia el futuro.</p>
      </section>

      <section id="programa" className="schedule section">
        <div className="section-label"><span>04</span> Programa</div>
        <div className="schedule-head">
          <h2>Un día.<br/>Dos escenarios.</h2>
          <p>Del recorrido por nuestra historia a una gran noche de celebración, música y gastronomía.</p>
        </div>
        <div className="timeline">
          <article className="history">
            <time>17:00 h</time><span className="dot"></span>
            <div>
              <h3>Visita a la exposición histórica</h3>
              <p><MapPin size={24} aria-hidden="true" />Hall de la Facultad de Veterinaria</p>
            </div>
          </article>
          <article className="party">
            <time>18:00 h</time><span className="dot"></span>
            <div>
              <h3>Cóctel de bienvenida</h3>
              <p><MapPin size={24} aria-hidden="true" />Finca Torreluna</p>
            </div>
          </article>
          <article className="party">
            <time>18:45 h</time><span className="dot"></span>
            <div>
              <h3>Acto oficial del 75.º aniversario</h3>
              <p><MapPin size={24} aria-hidden="true" />Agradecimiento y presentación de nuestra historia</p>
            </div>
          </article>
          <article className="party">
            <time>19:30 h</time><span className="dot"></span>
            <div>
              <h3>Aragón en el corazón</h3>
              <p><MapPin size={24} aria-hidden="true" />Escuela de Jota de Mallén</p>
            </div>
          </article>
          <article className="party">
            <time>20:00 h</time><span className="dot"></span>
            <div>
              <h3>Espectáculo de magia y humor</h3>
              <p><MapPin size={24} aria-hidden="true" />Finca Torreluna</p>
            </div>
          </article>
          <article className="party">
            <time>20:30 h</time><span className="dot"></span>
            <div>
              <h3>Vino español y degustación</h3>
              <p><MapPin size={24} aria-hidden="true" />Productos Bernal y empresas colaboradoras</p>
            </div>
          </article>
          <article className="party">
            <time>22:00 h</time><span className="dot"></span>
            <div>
              <h3>Fiesta y música en directo</h3>
              <p><MapPin size={24} aria-hidden="true" />Con el grupo Generación Pop y apertura de barra libre</p>
            </div>
          </article>
          <article className="party">
            <time>00:00 h</time><span className="dot"></span>
            <div>
              <h3>Recena</h3>
              <p><MapPin size={24} aria-hidden="true" />Segunda degustación de productos Embutidos Bernal</p>
            </div>
          </article>
          <article className="party">
            <time>00:00–04:00 h</time><span className="dot"></span>
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>DJ <img className="dj-logo" src="./dj-miguel-huerta.png?v=1" alt="MIGUELDEJOTA." /></h3>
              <p><MapPin size={24} aria-hidden="true" />Finca Torreluna</p>
            </div>
          </article>
          <article className="party">
            <time>04:00 h</time><span className="dot"></span>
            <div>
              <h3>Fin del acto</h3>
              <p><MapPin size={24} aria-hidden="true" />Finca Torreluna</p>
            </div>
          </article>
        </div>
      </section>

      <section className="details section">
        <div className="section-label light"><span>05</span> Información práctica</div>
        <h2>Todo lo que<br/>necesitas saber.</h2>
        <div className="detail-grid">
          <article>
            <Calendar size={24} aria-hidden="true" />
            <span>Fecha</span>
            <strong>10 de noviembre de 2026</strong>
          </article>
          <article>
            <Clock size={24} aria-hidden="true" />
            <span>Exposición histórica</span>
            <strong>17:00 h · Facultad de Veterinaria</strong>
            <p style={{ fontSize: '13.5px', color: 'var(--text-wine-sub)', lineHeight: '1.4', marginTop: '2px', marginBottom: '2px' }}>Miguel Servet, 177 · Zaragoza</p>
            <a href="https://maps.app.goo.gl/6KESW6yhABA5VNUbA?g_st=ic" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-wine-sub)', textDecoration: 'none', marginTop: '2px', textTransform: 'none', fontFamily: 'Inter, sans-serif', lineHeight: '1.4', fontWeight: 'normal' }}>
              Abrir en Google Maps <ArrowRight size={16} aria-hidden="true" />
            </a>
          </article>
          <article>
            <Clock size={24} aria-hidden="true" />
            <span>Celebración en Torreluna</span>
            <strong>18:00 h</strong>
          </article>
          <article>
            <MapPin size={24} aria-hidden="true" />
            <span>Torreluna</span>
            <strong>Finca Torreluna</strong>
            <p style={{ fontSize: '13.5px', color: 'var(--text-wine-sub)', lineHeight: '1.4', marginTop: '2px', marginBottom: '2px' }}>Miguel Servet, 193 · Zaragoza</p>
            <a href="https://maps.app.goo.gl/jver8wG8urWqLjdk8?g_st=ic" target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-wine-sub)', textDecoration: 'none', marginTop: '2px', textTransform: 'none', fontFamily: 'Inter, sans-serif', lineHeight: '1.4', fontWeight: 'normal' }}>
              Abrir en Google Maps <ArrowRight size={16} aria-hidden="true" />
            </a>
          </article>
          <article>
            <Shirt size={24} aria-hidden="true" />
            <span>Código de vestimenta</span>
            <strong>Festivo</strong>
            <p style={{fontSize: '13px', marginTop: '4px', color: 'var(--text-wine-sub)', lineHeight: '1.4'}}>¡Ponte tus mejores galas! Te sugerimos media etiqueta (traje o vestido de cóctel). Queremos que te sientas espectacular, sin necesidad de frac o vestido largo.</p>
          </article>
          <article>
            <UsersRound size={24} aria-hidden="true" />
            <span>Aforo</span>
            <p style={{ fontSize: '13.5px', color: 'var(--text-wine-sub)', lineHeight: '1.4', marginTop: '2px' }}>Por capacidad de la sala se limita a dos personas por empresa</p>
          </article>
          <article>
            <Phone size={24} aria-hidden="true" />
            <span>Contacto y consultas</span>
            <strong><a href="tel:+34976332229">976 33 22 29</a></strong>
          </article>
        </div>
      </section>

      <section className="rsvp-section" id="confirmacion">
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
                  <label className="form-label">Nombre y apellidos (Titular) *</label>
                  <input type="text" className="code-input" style={{textTransform: 'none', letterSpacing: 'normal'}} placeholder="Ej. Juan Pérez" value={nombreTitular} onChange={e => setNombreTitular(e.target.value)} required />
                </div>
              )}
              {attending && (
                <div className="form-group" style={{ animation: 'slideUp 0.3s ease-out' }}>
                  <label className="form-label">¿Vendrás con acompañante?</label>
                  <div className="radio-group" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: '16px' }}>
                    <div className="radio-option">
                      <input type="radio" id="comp-yes" name="companion" 
                        checked={companions === 1} onChange={() => setCompanions(1)} />
                      <label htmlFor="comp-yes">Sí</label>
                    </div>
                    <div className="radio-option">
                      <input type="radio" id="comp-no" name="companion" 
                        checked={companions === 0} onChange={() => setCompanions(0)} />
                      <label htmlFor="comp-no">No</label>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex', gap: '12px', alignItems: 'flex-start',
                    background: '#fdfbf6', borderLeft: '4px solid #cc0000',
                    padding: '16px', borderRadius: '2px 8px 8px 2px',
                    marginTop: '16px'
                  }}>
                    <UsersRound size={22} style={{ color: '#cc0000', flexShrink: 0, marginTop: '2px' }} />
                    <div style={{ color: '#333', fontSize: '13.5px', lineHeight: '1.6' }}>
                      Por motivos de aforo, la invitación está limitada a <strong style={{ color: '#333' }}>dos personas por empresa</strong>. 
                      Para solicitar plazas adicionales, consúltanos en el <strong style={{ color: '#cc0000', textDecoration: 'underline' }}>976 33 22 29</strong>.
                    </div>
                  </div>
                  
                  {companions === 1 && (
                    <div style={{ marginTop: '16px', animation: 'slideUp 0.3s ease-out' }}>
                      <label className="form-label">Nombre y apellidos (Acompañante) *</label>
                      <input type="text" className="code-input" style={{textTransform: 'none', letterSpacing: 'normal'}} placeholder="Ej. María García" value={nombreAcompanante} onChange={e => setNombreAcompanante(e.target.value)} required />
                    </div>
                  )}
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

      <footer>
        <div className="footer-mark">75</div>
        <img className="footer-logo footer-lockup" src="./bernal-hot-bull-cierre.png?v=5" alt="75.º aniversario de Embutidos Bernal y Hot Bull Saludable"/>
        <p>75 años de historia.<br/><strong>Y todavía nos queda mucho futuro por celebrar.</strong></p>
        
        {visitas !== null && (
          <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
            <Eye size={14} /> {visitas.toLocaleString('es-ES')} visitas
          </div>
        )}

        <div className="footer-contacts">
          <a href="https://www.instagram.com/embutidosbernal/" target="_blank" rel="noreferrer">
            <span style={{fontWeight:'bold'}}>@</span>embutidosbernal
          </a>
          <a href="tel:+34976332229">
            <Phone size={16} />976 33 22 29
          </a>
        </div>
        <span>Embutidos Bernal · 1951 — 2026</span>
      </footer>
    </main>
  )
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
