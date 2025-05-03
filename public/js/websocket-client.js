// public/js/websocket-client.js (versión de depuración)
class TrackerWebSocket {
  constructor() {
    console.log('Inicializando WebSocket...');
    this.connect();
  }

  connect() {
    try {
      console.log('Intentando conectar a WebSocket...');
      this.socket = new WebSocket('ws://localhost:3000/ws');

      this.socket.onopen = (event) => {
        console.log('WebSocket conectado!');
        // Subscribirse a todos los dispositivos
        this.socket.send(
          JSON.stringify({
            action: 'subscribeAll',
          })
        );
        console.log('Enviada suscripción a todos los dispositivos');
      };

      this.socket.onclose = (event) => {
        console.log('WebSocket desconectado. Código:', event.code);
      };

      this.socket.onerror = (error) => {
        console.error('Error WebSocket:', error);
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('Mensaje WebSocket recibido:', data);

          // Si es una actualización de ubicación, disparar un evento personalizado
          if (data.type === 'locationUpdate') {
            const locationEvent = new CustomEvent('location-update', {
              detail: data,
            });
            window.dispatchEvent(locationEvent);
            console.log('Evento location-update disparado con:', data);
          }
        } catch (e) {
          console.error('Error procesando mensaje WebSocket:', e);
        }
      };

      return true;
    } catch (error) {
      console.error('Error creando WebSocket:', error);
      return false;
    }
  }
}

// Crear instancia global
window.trackerWebSocket = new TrackerWebSocket();

// Agregar listener para pruebas
window.addEventListener('location-update', function (event) {
  console.log('⚡ Actualización de ubicación recibida:', event.detail);
});
