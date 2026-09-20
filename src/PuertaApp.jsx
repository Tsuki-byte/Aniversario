import React, { useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from './supabaseClient';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function PuertaApp() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [guestInfo, setGuestInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [scannerStarted, setScannerStarted] = useState(false);
  const [scannerError, setScannerError] = useState(null);

  const startScanner = () => {
    setScannerStarted(true);
    setScannerError(null);
    
    // We delay the initialization slightly to ensure the #reader div is mounted
    setTimeout(() => {
      try {
        let scanner = new Html5QrcodeScanner("reader", {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        }, false);

        const onScanSuccess = async (decodedText) => {
          let id = decodedText;
          try {
            const url = new URL(decodedText);
            const searchParams = new URLSearchParams(url.search);
            if (searchParams.has('id')) {
              id = searchParams.get('id');
            }
          } catch (e) {
            // Ignore
          }
          
          handleCheckIn(id);
        };

        scanner.render(onScanSuccess, (error) => {
          // Ignore normal scan failures
        });
      } catch(err) {
        setScannerError("Error iniciando la cámara: " + err.message);
      }
    }, 200);
  };

  const handleCheckIn = async (id) => {
    if (loading || (scanResult && scanResult.id === id)) return;
    
    setLoading(true);
    setErrorMsg(null);
    setGuestInfo(null);
    setScanResult({ id });

    try {
      const { data, error } = await supabase
        .from('invitados')
        .select('*')
        .eq('id', id)
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
          .eq('id', id);

        if (updateError) throw updateError;

        data.ha_entrado = true;
        setRecentScans(prev => [data, ...prev].slice(0, 5));
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Error al consultar: ' + e.message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setScanResult(null);
      }, 5000);
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
          <p style={{ marginTop: '15px', color: '#666' }}>
            Si el navegador te pide permisos, dale a "Permitir".
          </p>
        </div>
      ) : (
        <div id="reader" style={{ width: '100%', marginBottom: '20px', minHeight: '300px' }}></div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <Loader2 className="spin" size={32} />
          <p>Comprobando...</p>
        </div>
      )}

      {!loading && errorMsg && !guestInfo && (
        <div style={{ background: '#ffecec', color: '#d32f2f', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
          <XCircle size={40} style={{ margin: '0 auto' }} />
          <h3>¡Error!</h3>
          <p>{errorMsg}</p>
        </div>
      )}

      {!loading && guestInfo && (
        <div style={{ 
          background: errorMsg ? '#fff3cd' : '#e8f5e9', 
          color: errorMsg ? '#856404' : '#2e7d32', 
          padding: '20px', 
          borderRadius: '8px', 
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {errorMsg ? <XCircle size={48} color="#856404" /> : <CheckCircle size={48} color="#2e7d32" />}
          
          <h2 style={{ margin: '10px 0' }}>{guestInfo.nombre}</h2>
          
          {errorMsg ? (
            <p style={{ fontWeight: 'bold' }}>{errorMsg}</p>
          ) : (
            <>
              <p style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>¡ACCESO PERMITIDO!</p>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', margin: '15px 0' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Confirmados</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                    1 + {guestInfo.num_acompanantes || 0}
                  </div>
                </div>
                {guestInfo.mesa && (
                  <div>
                    <div style={{ fontSize: '0.8rem', textTransform: 'uppercase' }}>Mesa</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{guestInfo.mesa}</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {recentScans.length > 0 && (
        <div style={{ marginTop: '30px' }}>
          <h3>Últimos accesos</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {recentScans.map((g, i) => (
              <li key={i} style={{ padding: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                <span>{g.nombre}</span>
                <span style={{ color: '#888' }}>{1 + (g.num_acompanantes || 0)} pax</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
