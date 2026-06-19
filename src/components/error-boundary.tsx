import { Component, Fragment, type ReactNode, type ErrorInfo } from 'react';
import { Text, View, Pressable } from 'react-native';
import { Font } from '@/constants/fonts';
import { Palette, Spacing, Type } from '@/constants/theme';

type Props = { children: ReactNode; fallback?: ReactNode; onError?: (error: Error, info: ErrorInfo) => void };
type State = { error: Error | null; resetKey: number };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    // In production: send to error tracking (Sentry, etc.)
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return this.props.fallback ?? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: 16 }}>
          <Text style={{ fontFamily: Font.heading, fontSize: 18, color: Palette.ink, textAlign: 'center' }}>
            Something went wrong
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: Type.label, color: Palette.textSecondary, textAlign: 'center' }}>
            {this.state.error.message}
          </Text>
          <Pressable
            onPress={() => this.setState(prev => ({ error: null, resetKey: prev.resetKey + 1 }))}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: Palette.brand, borderRadius: 24 }}>
            <Text style={{ fontFamily: Font.semibold, fontSize: Type.body, color: '#fff' }}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>;
  }
}
