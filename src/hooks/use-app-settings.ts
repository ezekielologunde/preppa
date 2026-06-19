import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'app_settings';

const DEFAULTS = {
  hapticFeedback: true,
  soundEffects: false,
  showDietaryBadges: true,
  compactMealCards: false,
  personalizedRecs: true,
  usageAnalytics: true,
  currency: 'NGN',
  distanceUnit: 'km' as 'km' | 'mi',
};

export type AppSettings = typeof DEFAULTS;

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) as Partial<AppSettings> });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const update = useCallback(
    async (patch: Partial<AppSettings>) => {
      const next = { ...settings, ...patch };
      setSettings(next);
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    },
    [settings],
  );

  return { settings, update, loaded };
}
