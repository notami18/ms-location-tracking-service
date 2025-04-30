// URL base de la API
const API_BASE_URL = 'http://localhost:3000/api';

// Configuración para solicitudes
const API_CONFIG = {
  headers: {
    'Content-Type': 'application/json'
  }
};

// Para depuración
console.log('API_CONFIG:', API_CONFIG);

// Obtener todos los dispositivos
async function getDevices() {
  try {
    console.log('Solicitando dispositivos desde:', `${API_BASE_URL}/dashboard/stats`);
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, API_CONFIG);
    const data = await response.json();
    
    console.log('Respuesta de dispositivos:', data);
    
    if (!data.success) {
      throw new Error(data.message || 'Error al obtener dispositivos');
    }
    
    return data.stats.devices || [];
  } catch (error) {
    console.error('Error al obtener dispositivos:', error);
    return [];
  }
}

// Obtener estadísticas
async function getStats() {
  try {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, API_CONFIG);
    return await response.json();
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return { success: false, message: error.message };
  }
}

// Obtener historial de rutas
async function getRouteHistory(deviceId, days = 7) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/dashboard/route-history?deviceId=${deviceId}&days=${days}`,
      API_CONFIG
    );
    return await response.json();
  } catch (error) {
    console.error('Error al obtener historial de rutas:', error);
    return { success: false, message: error.message };
  }
}

// Obtener ruta específica
async function getDeviceRoute(deviceId, startDate, endDate) {
  try {
    let url = `${API_BASE_URL}/locations/route/${deviceId}`;

    // Añadir parámetros de fecha si están disponibles
    if (startDate && endDate) {
      url += `?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
    }

    const response = await fetch(url, API_CONFIG);
    return await response.json();
  } catch (error) {
    console.error('Error al obtener ruta del dispositivo:', error);
    return { success: false, message: error.message };
  }
}

// Obtener la última ubicación de un dispositivo
async function getLatestLocation(deviceId) {
  try {
    const response = await fetch(`${API_BASE_URL}/locations/latest/${deviceId}`, API_CONFIG);
    return await response.json();
  } catch (error) {
    console.error('Error al obtener la última ubicación:', error);
    return { success: false, message: error.message };
  }
}
