export interface GeoLocationCaptureResult {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string;
  isAvailable: boolean;
  errorMessage?: string;
}

/**
 * Standard event-based browser/device geolocation capture helper.
 * Captures coordinates only at specific key events (Arrival, Departure).
 * Does NOT run background continuous surveillance.
 * Rejects gracefully when denied or unavailable without breaking technician workflow.
 */
export async function captureEventGeolocation(): Promise<GeoLocationCaptureResult> {
  const timestamp = new Date().toISOString();

  if (typeof window === 'undefined' || !navigator || !navigator.geolocation) {
    return {
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedAt: timestamp,
      isAvailable: false,
      errorMessage: 'Geolocation API is not supported on this device/browser.'
    };
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: timestamp,
          isAvailable: true
        });
      },
      (error) => {
        let errorMsg = 'GPS capture unavailable.';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg = 'Location permission denied by technician/device.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg = 'GPS location unavailable or satellite fix timed out.';
            break;
          case error.TIMEOUT:
            errorMsg = 'Location request timed out.';
            break;
        }

        resolve({
          latitude: null,
          longitude: null,
          accuracy: null,
          capturedAt: timestamp,
          isAvailable: false,
          errorMessage: errorMsg
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000
      }
    );
  });
}
