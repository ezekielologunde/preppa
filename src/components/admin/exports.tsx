import { Download } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Platform, Share, Text, TouchableOpacity, View } from 'react-native';

import { Font } from '@/constants/fonts';
import { Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import {
  exportOrdersList,
  exportPlatformRevenue,
  exportPreppersSummary,
} from '@/lib/queries/admin-export';
import { Admin, Card } from './ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Days = 7 | 30 | 90;

const PERIOD_OPTIONS: { label: string; days: Days }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function downloadCsv(content: string, filename: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await Share.share({ message: content, title: filename });
  }
}

// ---------------------------------------------------------------------------
// Period selector
// ---------------------------------------------------------------------------

function PeriodSelector({ value, onChange }: { value: Days; onChange: (d: Days) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
      {PERIOD_OPTIONS.map(({ label, days }) => {
        const active = days === value;
        return (
          <TouchableOpacity
            key={days}
            onPress={() => { feedback.tap(); onChange(days); }}
            accessibilityRole="button"
            accessibilityLabel={`Last ${label}`}
            accessibilityState={{ selected: active }}
            style={{
              borderRadius: Radius.pill,
              paddingHorizontal: 16,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? Admin.brand : Admin.card,
              borderWidth: 1,
              borderColor: active ? Admin.brand : Admin.border,
            }}>
            <Text
              style={{
                fontFamily: Font.semibold,
                fontSize: 13,
                color: active ? '#fff' : Admin.textDim,
              }}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Export card
// ---------------------------------------------------------------------------

type ExportCardProps = {
  title: string;
  subtitle: string;
  filename: string;
  onExport: () => Promise<string>;
};

function ExportCard({ title, subtitle, filename, onExport }: ExportCardProps) {
  const [loading, setLoading] = useState(false);

  async function handlePress() {
    if (loading) return;
    feedback.tap();
    setLoading(true);
    try {
      const csv = await onExport();
      await downloadCsv(csv, filename);
      feedback.success();
    } catch {
      feedback.error?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: Font.semibold, fontSize: 14, color: Admin.text }}>
            {title}
          </Text>
          <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`Download ${title} as CSV`}
          disabled={loading}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderWidth: 1.5,
            borderColor: Admin.brand,
            borderRadius: Radius.pill,
            paddingHorizontal: 14,
            height: 36,
            opacity: loading ? 0.7 : 1,
          }}>
          {loading ? (
            <ActivityIndicator size="small" color={Admin.brand} />
          ) : (
            <Download size={13} color={Admin.brand} />
          )}
          <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: Admin.brand }}>
            {loading ? 'Exporting...' : 'Download CSV'}
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function AdminExports() {
  const [days, setDays] = useState<Days>(30);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: Font.semibold, fontSize: 15, color: Admin.text }}>
          Data exports
        </Text>
        <Text style={{ fontFamily: Font.body, fontSize: 12, color: Admin.textDim }}>
          Download platform data as CSV files for reporting and accounting.
        </Text>
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: Font.medium, fontSize: 11, color: Admin.textDim, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Period
        </Text>
        <PeriodSelector value={days} onChange={setDays} />
      </View>

      <View style={{ gap: 10 }}>
        <ExportCard
          title="Platform revenue"
          subtitle="GMV, orders, and platform fees (15%)"
          filename={`preppa-revenue-${days}d.csv`}
          onExport={() => exportPlatformRevenue(days)}
        />
        <ExportCard
          title="Orders list"
          subtitle="All orders with customer and kitchen info"
          filename={`preppa-orders-${days}d.csv`}
          onExport={() => exportOrdersList(days)}
        />
        <ExportCard
          title="Kitchens summary"
          subtitle="All preppers, ratings, and order count"
          filename="preppa-kitchens.csv"
          onExport={exportPreppersSummary}
        />
      </View>
    </View>
  );
}
