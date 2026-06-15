import * as Location from 'expo-location';
import { createContext, useContext, useState, type ReactNode } from 'react';

type DeviceLocation = {
  city: string;
  state: string;
  coords: { lat: number; lng: number } | null;
  status: 'idle' | 'requesting' | 'granted' | 'denied' | 'error';
  fetchedAt: number | null;
};

type LocationContextType = {
  loc: DeviceLocation;
  requestDeviceLocation: () => Promise<DeviceLocation['status']>;
};

const LOCATION_STALE_MS = 30 * 60 * 1000; // 30 minutes

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<DeviceLocation>({
    city: '', state: '', coords: null, status: 'idle', fetchedAt: null,
  });

  async function requestDeviceLocation(): Promise<DeviceLocation['status']> {
    if (loc.status === 'granted' && loc.fetchedAt && Date.now() - loc.fetchedAt < LOCATION_STALE_MS) {
      return 'granted';
    }
    setLoc((prev) => ({ ...prev, status: 'requesting' }));
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoc((prev) => ({ ...prev, status: 'denied' }));
        return 'denied';
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      const city = place?.city ?? place?.district ?? place?.subregion ?? '';
      const state = place?.region ?? '';
      setLoc({ city, state, coords: { lat: pos.coords.latitude, lng: pos.coords.longitude }, status: 'granted', fetchedAt: Date.now() });
      return 'granted';
    } catch {
      setLoc((prev) => ({ ...prev, status: 'error' }));
      return 'error';
    }
  }

  return (
    <LocationContext.Provider value={{ loc, requestDeviceLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useDeviceLocation() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useDeviceLocation must be used within LocationProvider');
  return ctx;
}
