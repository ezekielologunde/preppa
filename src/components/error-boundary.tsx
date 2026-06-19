import React from 'react';
import { View, Text, Pressable } from 'react-native';

import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Could log to Sentry/logging service here
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ flex: 1, backgroundColor: Palette.canvas, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🍳</Text>
          <Text style={{ fontFamily: Font.display, fontSize: 24, color: Palette.ink, textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 }}>
            Something went wrong
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 15, color: Palette.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
            The app hit an unexpected error. Your data is safe — tap below to restart.
          </Text>
          <Pressable
            onPress={() => this.setState({ hasError: false })}
            style={{ backgroundColor: Palette.brand, borderRadius: Radius.lg, paddingHorizontal: 28, paddingVertical: 14 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
