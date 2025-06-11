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
          response = await fetch('/api/dashboard/stats', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
        } else {
          response = await fetch('/api/dashboard/stats');
        }

        if (!response.ok) {
          throw new Error(`Error: ${response.status}`);
        }

        const result = await response.json();
        console.log('Respuesta completa de dispositivos:', result);

        // Manejar diferentes formatos de respuesta
        let devices = result;

        if (result?.data) {
          devices = result.data;
        } else if (result?.stats?.devices) {
          devices = result.stats.devices;
        }

        if (Array.isArray(devices) && devices.length > 0) {
          return devices;
        }
      }
    } catch (error) {
      console.error('Error obteniendo dispositivos:', error);
    }
  },

  async getStats() {
    try {
      const response = await fetch('/api/dashboard/stats', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return { success: false, message: 'Error obteniendo estadísticas' };
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

  async getRouteHistory(deviceId, days = 7) {
    try {
      const response = await fetch(
        `/api/dashboard/route-history?deviceId=${deviceId}&days=${days}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Error al obtener historial de rutas:', error);
      return { success: false, message: error.message };
    }
  },

  async getDeviceRoute(deviceId, startDate, endDate) {
    try {
      let url = `/api/locations/route/${deviceId}`;

      // Añadir parámetros de fecha si están disponibles
      if (startDate && endDate) {
        url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });
      return await response.json();
    } catch (error) {
      console.error('Error al obtener ruta del dispositivo:', error);
      return { success: false, message: error.message };
    }
  },
};

// Si estamos en un entorno que soporta module.exports (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { apiClient };
}
