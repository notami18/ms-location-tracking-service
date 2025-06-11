/**
 * Cliente WebSocket para el Sistema de Tracking de Ubicaciones
 * Maneja la conexión y procesamiento de mensajes de ubicación en tiempo real
 */
class LocationWebSocketClient {
  constructor(options = {}) {
    // Configuración
    this.baseUrl = options.baseUrl || this._getWebSocketUrl();
    this.reconnectInterval = options.reconnectInterval || 3000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.pingInterval = options.pingInterval || 30000;

    // Estado
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.pingTimer = null;
    this.deviceSubscriptions = new Set();

    // Callbacks
    this.onConnect =
      options.onConnect || (() => console.log('WebSocket conectado'));
    this.onDisconnect =
      options.onDisconnect || (() => console.log('WebSocket desconectado'));
    this.onLocationUpdate =
      options.onLocationUpdate ||
      ((data) => {
        console.log('Actualización de ubicación recibida:', data);
        
        // Añadir esta línea para depuración
        console.log(`Comparando deviceId recibido: ${data.deviceId} con el actual: ${currentDeviceId}`);
        
        // Actualizar marcador en el mapa
        if (data && data.deviceId) {
          // Siempre mostrar todos los dispositivos sin filtrar
          updateDeviceLocation(data);
        }
      });
    this.onActiveDevicesUpdate =
      options.onActiveDevicesUpdate ||
      ((data) => console.log('Dispositivos activos:', data));
    this.onDeviceStatus =
      options.onDeviceStatus ||
      ((data) => console.log('Estado del dispositivo:', data));
    this.onError =
      options.onError || ((error) => console.error('Error WebSocket:', error));
    this.onReconnect =
      options.onReconnect ||
      ((attempt) => console.log(`Reconectando (intento ${attempt})...`));
    this.onSubscriptionResponse =
      options.onSubscriptionResponse ||
      ((resp) => console.log('Respuesta de suscripción:', resp));

    // Inicializar si autoConectar es true
    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  /**
   * Determina la URL de WebSocket basado en el entorno
   */
  _getWebSocketUrl() {
    // Configuración para desarrollo local
    if (
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    ) {
      return 'ws://localhost:3001';
    }

    // Para producción, determinar dinámicamente
    // El formato típico para API Gateway es wss://[id].execute-api.[region].amazonaws.com/[stage]
    // Esto debería configurarse desde el servidor o variables de entorno
    const apiGatewayId = window.WS_API_ID || 'your-api-id';
    const region = window.WS_REGION || 'us-east-1';
    const stage = window.WS_STAGE || 'dev';

    return `wss://${apiGatewayId}.execute-api.${region}.amazonaws.com/${stage}`;
  }

  /**
   * Establecer conexión WebSocket
   */
  connect() {
    try {
      console.log(`Conectando a WebSocket: ${this.baseUrl}`);
      this.socket = new WebSocket(this.baseUrl);

      this.socket.onopen = this._handleOpen.bind(this);
      this.socket.onclose = this._handleClose.bind(this);
      this.socket.onerror = this._handleError.bind(this);
      this.socket.onmessage = this._handleMessage.bind(this);
    } catch (error) {
      console.error('Error inicializando WebSocket:', error);
      this._scheduleReconnect();
    }
  }

  /**
   * Maneja la apertura de conexión
   */
  _handleOpen() {
    console.log('WebSocket conectado');
    this.isConnected = true;
    this.reconnectAttempts = 0;

    // Restaurar suscripciones
    this._restoreSubscriptions();

    // Iniciar ping para mantener la conexión
    this._startPing();

    // Ejecutar callback de conexión
    if (this.onConnect) {
      this.onConnect();
    }
  }

  /**
   * Maneja el cierre de conexión
   */
  _handleClose(event) {
    console.log(`WebSocket desconectado: ${event.code} - ${event.reason}`);
    this.isConnected = false;
    this._stopPing();

    // Ejecutar callback de desconexión
    if (this.onDisconnect) {
      this.onDisconnect(event);
    }

    // Intentar reconexión
    this._scheduleReconnect();
  }

  /**
   * Maneja errores de WebSocket
   */
  _handleError(error) {
    console.error('Error de WebSocket:', error);

    // Ejecutar callback de error
    if (this.onError) {
      this.onError(error);
    }
  }

  /**
   * Procesa los mensajes recibidos
   */
  _handleMessage(event) {
    try {
      const message = JSON.parse(event.data);
      console.debug('Mensaje WebSocket recibido:', message);

      // Manejar diferentes tipos de mensajes
      switch (message.type) {
        case 'location_update':
          if (this.onLocationUpdate) {
            this.onLocationUpdate(message.data);
          }
          break;

        case 'active_devices_update':
        case 'active_devices_response':
        case 'active_devices_init':
          if (this.onActiveDevicesUpdate) {
            this.onActiveDevicesUpdate(message.data, message.count);
          }
          break;

        case 'device_status':
          if (this.onDeviceStatus) {
            this.onDeviceStatus(message.data);
          }
          break;

        case 'subscription_response':
          if (this.onSubscriptionResponse) {
            this.onSubscriptionResponse(message);
          }
          break;

        case 'pong':
          // Respuesta a ping, no requiere acción
          console.debug('Pong recibido:', message.timestamp);
          break;

        case 'error':
          console.error('Error en mensaje WebSocket:', message.message);
          if (this.onError) {
            this.onError(message);
          }
          break;

        default:
          console.warn('Tipo de mensaje no manejado:', message.type);
      }
    } catch (error) {
      console.error('Error parseando mensaje WebSocket:', error, event.data);
    }
  }

  /**
   * Programa intento de reconexión
   */
  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(
        `Alcanzado máximo de intentos de reconexión (${this.maxReconnectAttempts})`
      );
      return;
    }

    this.reconnectAttempts++;

    if (this.onReconnect) {
      this.onReconnect(this.reconnectAttempts);
    }

    console.log(
      `Programando reconexión en ${this.reconnectInterval}ms (intento ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      if (!this.isConnected) {
        this.connect();
      }
    }, this.reconnectInterval);
  }

  /**
   * Inicia ping periódico para mantener conexión
   */
  _startPing() {
    this._stopPing();

    this.pingTimer = setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({ action: 'ping', timestamp: Date.now() });
      }
    }, this.pingInterval);
  }

  /**
   * Detiene el ping periódico
   */
  _stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  /**
   * Restaura las suscripciones después de reconexión
   */
  _restoreSubscriptions() {
    if (this.deviceSubscriptions.size > 0) {
      console.log(
        'Restaurando suscripciones:',
        Array.from(this.deviceSubscriptions)
      );

      // Restaurar suscripción a "todos" si existe
      if (this.deviceSubscriptions.has('all')) {
        this.subscribeToAll();
      }

      // Restaurar suscripciones específicas
      this.deviceSubscriptions.forEach((deviceId) => {
        if (deviceId !== 'all') {
          this.subscribeToDevice(deviceId);
        }
      });
    }
  }

  /**
   * Envía un mensaje al servidor WebSocket
   */
  sendMessage(message) {
    if (!this.isConnected) {
      console.warn('No se puede enviar mensaje: WebSocket no conectado');
      return false;
    }

    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error enviando mensaje WebSocket:', error);
      return false;
    }
  }

  /**
   * Suscribirse a actualizaciones de un dispositivo específico
   */
  subscribeToDevice(deviceId) {
    if (!deviceId) {
      console.error('Se requiere deviceId para suscribirse');
      return false;
    }

    // Guardar en registro de suscripciones
    this.deviceSubscriptions.add(deviceId);

    return this.sendMessage({
      action: 'subscribe',
      deviceId: deviceId,
    });
  }

  /**
   * Suscribirse a todos los dispositivos
   */
  subscribeToAll() {
    // Guardar en registro de suscripciones
    this.deviceSubscriptions.add('all');

    return this.sendMessage({
      action: 'subscribeAll',
    });
  }

  /**
   * Cancelar suscripción a un dispositivo
   */
  unsubscribeFromDevice(deviceId) {
    if (!deviceId) {
      console.error('Se requiere deviceId para cancelar suscripción');
      return false;
    }

    // Eliminar de registro de suscripciones
    this.deviceSubscriptions.delete(deviceId);

    return this.sendMessage({
      action: 'unsubscribe',
      deviceId: deviceId,
    });
  }

  /**
   * Solicitar lista de dispositivos activos
   */
  requestActiveDevices() {
    return this.sendMessage({
      action: 'getActiveDevices',
    });
  }

  /**
   * Cerrar conexión manualmente
   */
  disconnect() {
    if (this.socket) {
      this._stopPing();
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
      this.deviceSubscriptions.clear();
    }
  }
}

// Exportar para uso con módulos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LocationWebSocketClient;
}
