import React, { useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from './supabaseClient';
import { CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';

export default function PuertaApp() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestInfo, setGuestInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannerError, setScannerError] = useState(null);
  
  const scannerRef = useRef(null);

  const startScanner = () => {
    setScannerStarted(true);
    setScannerError(null);
    
    setTimeout(() => {
      try {
        let scanner = new Html5QrcodeScanner("reader", {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        }, false);
        
        scannerRef.current = scanner;

        const onScanSuccess = async (decodedText) => {
          // Pause scanning to prevent flickering
          if (scannerRef.current && scannerRef.current.getState() !== 3) {
            scannerRef.current.pause(true);
          }
          
          let id = decodedText;
          try {
            const url = new URL(decodedText);
            const searchParams = new URLSearchParams(url.search);
            if (searchParams.has('id')) {
              id = searchParams.get('id');
            }
          } catch (e) {}
          
          handleCheckIn(id);
        };

        scanner.render(onScanSuccess, (error) => {});
      } catch(err) {
        setScannerError("Error iniciando la cámara: " + err.message);
      }
    }, 200);
  };

  const handleNext = () => {
    setScanResult(null);
    setGuestInfo(null);
    setErrorMsg(null);
    if (scannerRef.current) {
      scannerRef.current.resume();
    }
  };

  const handleCheckIn = async (id) => {
    if (loading) return;
    
    setLoading(true);
    setErrorMsg(null);
    setGuestInfo(null);
    setScanResult({ id });

    try {
      const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .eq('codigo_acceso', id.toUpperCase())
        .single();

      if (error) throw error;

      if (!data) {
        setErrorMsg('Invitado no encontrado en la base de datos.');
        setLoading(false);
        return;
      }

      setGuestInfo(data);

      if (data.ha_entrado) {
        setErrorMsg('ESTE INVITADO YA HA ENTRADO ANTERIORMENTE.');
      } else {
        const { error: updateError } = await supabase
          .from('invitados')
          .update({ ha_entrado: true, hora_entrada: new Date().toISOString() })
          .eq('id', data.id);

        if (updateError) throw updateError;

        data.ha_entrado = true;
        setRecentScans(prev => [data, ...prev].slice(0, 5));
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Error al consultar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '500px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ textAlign: 'center', color: '#b68735' }}>Control de Acceso</h1>
      
      {scannerError && (
        <div style={{ background: '#ffecec', color: '#d32f2f', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          {scannerError}
        </div>
      )}

      {/* Si no hemos leído nada y no hay error de lectura, mostramos el lector o el botón de arrancar */}
      <div style={{ display: (scanResult || loading) ? 'none' : 'block' }}>
        {!scannerStarted ? (
          <div style={{ textAlign: 'center', margin: '40px 0' }}>
            <button 
              onClick={startScanner}
              style={{
                background: '#b68735',
                color: 'white',
                border: 'none',
                padding: '15px 30px',
                fontSize: '1.2rem',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Encender Cámara 📸
            </button>
          </div>
        ) : (
          <div id="reader" style={{ width: '100%', marginBottom: '20px', minHeight: '300px' }}></div>
        )}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Loader2 className="spin" size={32} />
          <p>Comprobando...</p>
        </div>
      )}

      {/* Resultado de la lectura */}
      {!loading && scanResult && (
        <div style={{ textAlign: 'center' }}>
          
          {errorMsg && !guestInfo && (
            <div style={{ background: '#ffecec', color: '#d32f2f', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
              <XCircle size={40} style={{ margin: '0 auto' }} />
              <h3>¡Error!</h3>
              <p>{errorMsg}</p>
            </div>
          )}

          {guestInfo && (
            <div style={{ 
              background: errorMsg ? '#fff3cd' : '#e8f5e9', 
              color: errorMsg ? '#856404' : '#2e7d32', 
              padding: '20px', 
              borderRadius: '8px', 
              marginBottom: '20px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
              {errorMsg ? <XCircle size={48} color="#856404" style={{ margin: '0 auto' }} /> : <CheckCircle size={48} color="#2e7d32" style={{ margin: '0 auto' }} />}
              
              <h2 style={{ margin: '10px 0', color: '#333' }}>{guestInfo.nombre}</h2>
              
              {/* Avisos de Confirmación */}
              {(guestInfo.estado_asistencia !== 'Confirmado') && (
                <div style={{ background: '#fff', color: '#d32f2f', padding: '10px', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '15px', fontWeight: 'bold' }}>
                  <AlertTriangle size={24} />
                  NO HA CONFIRMADO ASISTENCIA
                </div>
              )}
              
              {errorMsg ? (
                <p style={{ fontWeight: 'bold' }}>{errorMsg}</p>
              ) : (
                <p style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>¡ACCESO PERMITIDO!</p>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '15px 0' }}>
                <div style={{ background: 'rgba(255,255,255,0.5)', padding: '10px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#555' }}>Previstos</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                    1 + {guestInfo.prev_acompanantes || 0}
                  </div>
                </div>
                {guestInfo.estado_asistencia === 'Confirmado' && (
                  <div style={{ background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#555' }}>Confirmados</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>
                      1 + {guestInfo.conf_acompanantes || 0}
                    </div>
                  </div>
                )}
                {guestInfo.mesa && (
                  <div style={{ background: 'rgba(255,255,255,0.8)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: '#555' }}>Mesa</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#333' }}>{guestInfo.mesa}</div>
                  </div>
                )}
              </div>

            </div>
          )}

          <button 
            onClick={handleNext}
            style={{
              background: '#333',
              color: 'white',
              border: 'none',
              padding: '15px 30px',
              fontSize: '1.1rem',
              borderRadius: '8px',
              cursor: 'pointer',
              width: '100%'
            }}
          >
            Siguiente Invitado ➔
          </button>
        </div>
      )}

      {recentScans.length > 0 && !scanResult && (
        <div style={{ marginTop: '30px' }}>
          <h3>Últimos accesos</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recentScans.map((g, i) => (
              <li key={i} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <span>{g.nombre}</span>
                <span style={{ color: '#888' }}>
                  {1 + (g.conf_acompanantes !== null ? g.conf_acompanantes : (g.prev_acompanantes || 0))} pax
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
