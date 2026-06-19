import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

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
// Cached across cold starts so we can restore location state without calling the
// OS permission API on every launch (avoids a slow reverse-geocode on each open).
const LOCATION_CACHE_KEY = 'preppa.location.granted.v1';

type LocationCache = {
  city: string;
  state: string;
  coords: { lat: number; lng: number } | null;
  fetchedAt: number;
};

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [loc, setLoc] = useState<DeviceLocation>({
    city: '', state: '', coords: null, status: 'idle', fetchedAt: null,
  });

  // On mount: restore cached location if it is still fresh, so screens that
  // rely on loc.status === 'granted' don't flicker to empty on every cold start.
  useEffect(() => {
    AsyncStorage.getItem(LOCATION_CACHE_KEY)
      .then((raw) => {
        if (!raw) return;
        const cached: LocationCache = JSON.parse(raw);
        if (Date.now() - cached.fetchedAt < LOCATION_STALE_MS) {
          setLoc({
            city: cached.city,
            state: cached.state,
            coords: cached.coords,
            status: 'granted',
            fetchedAt: cached.fetchedAt,
          });
        }
      })
      .catch(() => {}); // non-fatal
  }, []);

  async function requestDeviceLocation(): Promise<DeviceLocation['status']> {
    if (Platform.OS === 'web') return 'denied'; // expo-location geolocation is not reliable on web
    if (loc.status === 'granted' && loc.fetchedAt && Date.now() - loc.fetchedAt < LOCATION_STALE_MS) {
      return 'granted';
    }
    setLoc((prev) => ({ ...prev, status: 'requesting' }));
    try {
      // Check existing permission first — avoids triggering the OS dialog when
      // the user already granted access in a previous session.
      const { status: existing } = await Location.getForegroundPermissionsAsync();
      const status = existing === 'granted'
        ? 'granted'
        : (await Location.requestForegroundPermissionsAsync()).status;

      if (status !== 'granted') {
        setLoc((prev) => ({ ...prev, status: 'denied' }));
        return 'denied';
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      const city = place?.city ?? place?.district ?? place?.subregion ?? '';
      const state = place?.region ?? '';
      const fetchedAt = Date.now();
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLoc({ city, state, coords, status: 'granted', fetchedAt });

      // Persist so the next cold start can skip the permission + geocode round-trip.
      const cache: LocationCache = { city, state, coords, fetchedAt };
      AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(cache)).catch(() => {});

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
