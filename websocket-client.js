class TrackerWebSocket {
  constructor(options = {}) {
    this.baseUrl =
      options.baseUrl || window.location.origin.replace(/^http/, 'ws');
    this.token = options.token;
    this.reconnectTimeout = options.reconnectTimeout || 5000;
    this.maxReconnects = options.maxReconnects || 5;
    this.reconnectCount = 0;
    this.automaticReconnect = options.automaticReconnect !== false;
    this.listeners = {
      locationUpdate: [],
      connect: [],
      disconnect: [],
      error: [],
    };

    this.isConnected = false;
    this.socket = null;

    // Si tenemos token, conectar inmediatamente
    if (this.token) {
      this.connect();
    }
  }

  setToken(token) {
    this.token = token;

    // Si ya hay una conexión activa, cerrarla para reconectar con nuevo token
    if (this.socket) {
      this.socket.close();
    }

    // Conectar con nuevo token
    this.connect();
  }

  connect() {
    if (!this.token) {
      this._triggerEvent('error', {
        message: 'No se puede conectar sin token',
      });
      return false;
    }

    try {
      // Construir URL con token para autenticación
      const wsUrl = `${this.baseUrl}/ws?token=${this.token}`;
      this.socket = new WebSocket(wsUrl);

      // Configurar event handlers
      this.socket.onopen = this._handleOpen.bind(this);
      this.socket.onclose = this._handleClose.bind(this);
      this.socket.onerror = this._handleError.bind(this);
      this.socket.onmessage = this._handleMessage.bind(this);

      return true;
    } catch (error) {
      this._triggerEvent('error', error);
      return false;
    }
  }

  disconnect() {
    if (this.socket) {
      // Desactivar reconexión automática
      this.automaticReconnect = false;
      this.socket.close();
    }
  }

  _handleOpen(event) {
    console.log('WebSocket conectado');
    this.isConnected = true;
    this.reconnectCount = 0;
    this._triggerEvent('connect', event);

    // Iniciar ping periódico para mantener conexión activa
    this._startPingInterval();
  }

  _handleClose(event) {
    console.log(`WebSocket desconectado: ${event.code}`);
    this.isConnected = false;
    this._triggerEvent('disconnect', event);

    // Cancelar ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Reconectar automáticamente si está habilitado
    if (this.automaticReconnect && this.reconnectCount < this.maxReconnects) {
      this.reconnectCount++;
      const timeout =
        this.reconnectTimeout * Math.pow(1.5, this.reconnectCount - 1);
      console.log(
        `Reconectando en ${timeout}ms (intento ${this.reconnectCount})`
      );

      setTimeout(() => {
        this.connect();
      }, timeout);
    }
  }

  _handleError(error) {
    console.error('Error WebSocket:', error);
    this._triggerEvent('error', error);
  }

  _handleMessage(event) {
    try {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'locationUpdate':
          this._triggerEvent('locationUpdate', {
            deviceId: data.deviceId,
            location: data.data,
          });
          break;

        case 'connection':
          // Mensaje de confirmación de conexión
          console.log('Conexión confirmada:', data);
          break;

        case 'subscription':
          // Confirmación de suscripción
          console.log('Suscripción confirmada:', data);
          break;

        case 'pong':
          // Respuesta a ping
          const latency = Date.now() - data.timestamp;
          console.log(`WebSocket latencia: ${latency}ms`);
          break;

        default:
          console.log('Mensaje no reconocido:', data);
      }
    } catch (error) {
      console.error('Error procesando mensaje:', error);
    }
  }

  _startPingInterval() {
    // Enviar ping cada 30 segundos para mantener conexión activa
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send({ action: 'ping', timestamp: Date.now() });
      }
    }, 30000);
  }

  _triggerEvent(eventName, data) {
    if (this.listeners[eventName]) {
      this.listeners[eventName].forEach((callback) => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Error en listener ${eventName}:`, e);
        }
      });
    }
  }

  // Métodos públicos para enviar mensajes
  send(data) {
    if (this.isConnected) {
      this.socket.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  // Suscribirse a un dispositivo específico
  subscribeToDevice(deviceId) {
    return this.send({
      action: 'subscribe',
      deviceId,
    });
  }

  // Suscribirse a todos los dispositivos
  subscribeToAllDevices() {
    return this.send({
      action: 'subscribeAll',
    });
  }

  // Event listeners
  onConnect(callback) {
    this.listeners.connect.push(callback);
  }

  onDisconnect(callback) {
    this.listeners.disconnect.push(callback);
  }

  onError(callback) {
    this.listeners.error.push(callback);
  }

  onLocationUpdate(callback) {
    this.listeners.locationUpdate.push(callback);
  }
}

// Exportar la clase
window.TrackerWebSocket = TrackerWebSocket;
