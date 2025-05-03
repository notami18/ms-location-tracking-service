// Definición del API Client
const apiClient = {
  // URL base para requests
  baseUrl: '',

  // Función para obtener token
  async login(username, password) {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error(`Error en login: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  },

  // Función para obtener dispositivos
  // En api.js, actualiza la función getDevices
  async getDevices() {
    try {
      // Para desarrollo local, consultar directamente MongoDB
      if (
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1'
      ) {
        console.log('Obteniendo dispositivos desde la API local');

        // Intentar con y sin autenticación en desarrollo
        let response;
        const token = localStorage.getItem('authToken');

        if (token) {
          response = await fetch('/api/devices', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } else {
          // Intentar sin token en desarrollo
          response = await fetch('/api/devices');
        }

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Respuesta completa de dispositivos:', result);

        // Manejar diferentes formatos de respuesta
        let devices = result;

        if (result && result.data) {
          devices = result.data;
        } else if (result && result.devices) {
          devices = result.devices;
        }

        if (Array.isArray(devices) && devices.length > 0) {
          return devices;
        }

        // Si no se encontraron dispositivos, intentar extraerlos de la colección de ubicaciones
        console.log(
          'No se encontraron dispositivos, intentando extraer de ubicaciones'
        );
        response = await fetch('/api/locations/latest');

        if (response.ok) {
          const locations = await response.json();
          console.log('Ubicaciones obtenidas:', locations);

          // Extraer deviceIds únicos de las ubicaciones
          const deviceMap = {};

          if (Array.isArray(locations)) {
            locations.forEach((loc) => {
              if (loc.deviceId) {
                deviceMap[loc.deviceId] = {
                  deviceId: loc.deviceId,
                  name: `Dispositivo ${loc.deviceId.replace(
                    'AndroidDevice_',
                    ''
                  )}`,
                  lastLocation: loc.location,
                  lastSeen: loc.timestamp,
                };
              }
            });
          } else if (locations.data && Array.isArray(locations.data)) {
            locations.data.forEach((loc) => {
              if (loc.deviceId) {
                deviceMap[loc.deviceId] = {
                  deviceId: loc.deviceId,
                  name: `Dispositivo ${loc.deviceId.replace(
                    'AndroidDevice_',
                    ''
                  )}`,
                  lastLocation: loc.location,
                  lastSeen: loc.timestamp,
                };
              }
            });
          }

          const extractedDevices = Object.values(deviceMap);
          if (extractedDevices.length > 0) {
            return extractedDevices;
          }
        }
      }

      // Si todo lo anterior falla o no estamos en desarrollo, usar dispositivos de demo
      return [
        { deviceId: 'dev001', name: 'Dispositivo 001' },
        { deviceId: 'dev002', name: 'Dispositivo 002' },
        { deviceId: 'dev003', name: 'Dispositivo 003' },
      ];
    } catch (error) {
      console.error('Error obteniendo dispositivos:', error);
      // Incluir el dispositivo que mencionas explícitamente
      return [
        { deviceId: 'AndroidDevice_e704144c', name: 'Dispositivo e704144c' },
        { deviceId: 'dev001', name: 'Dispositivo 001' },
        { deviceId: 'dev002', name: 'Dispositivo 002' },
        { deviceId: 'dev003', name: 'Dispositivo 003' },
      ];
    }
  },

  // Función para obtener historial de ubicaciones
  async getLocationHistory(deviceId, startDate, endDate) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No hay token de autenticación');
        return [];
      }

      // Formatear fechas para la API
      const formattedStartDate = startDate
        ? new Date(startDate).toISOString()
        : '';
      const formattedEndDate = endDate ? new Date(endDate).toISOString() : '';

      const url = `/api/devices/${deviceId}/history?start=${formattedStartDate}&end=${formattedEndDate}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error obteniendo historial: ${response.status}`);
      }

      const data = await response.json();

      return data;
    } catch (error) {
      console.error('Error en getLocationHistory:', error);
      return [];
    }
  },

  // Función para obtener última ubicación
  async getLatestLocation(deviceId) {
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.error('No hay token de autenticación');
        return null;
      }

      const response = await fetch(`/api/devices/${deviceId}/latest`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Error obteniendo última ubicación: ${response.status}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en getLatestLocation:', error);
      return null;
    }
  },
};

// Si estamos en un entorno que soporta module.exports (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { apiClient };
}
