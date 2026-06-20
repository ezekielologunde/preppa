import { Redirect } from 'expo-router';

// Consolidated into notification-preferences — this redirect keeps old deep-links working.
export default function NotificationSettingsRedirect() {
  return <Redirect href={'/notification-preferences' as never} />;
}
