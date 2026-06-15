import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { ChevronLeft, Hash, ImagePlus, Video } from 'lucide-react-native';
import { MotiView } from 'moti';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Font } from '@/constants/fonts';
import { Palette, Radius } from '@/constants/theme';
import { feedback } from '@/lib/feedback';
import { supabase } from '@/lib/supabase';
import { pickAndUploadImage } from '@/lib/upload';
import { useMyPrepperApplication } from '@/lib/queries/preppers';
import { useAuth } from '@/providers/auth-provider';

const cleanBlock = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

const ORANGE = Palette.brand;
const CARD = Palette.prepperCard;
const BG = Palette.prepperBg;
const MUTED = Palette.textMuted;

const TAGS = ['Meal prep', 'Quick & easy', 'Healthy', 'Comfort food', 'Vegan', 'High-protein', 'Behind the scenes', 'New dish'];

export default function PostVideoScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: prepper } = useMyPrepperApplication(user?.id);
  const qc = useQueryClient();

  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [thumb, setThumb] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [posted, setPosted] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);

  if (!prepper || prepper.status !== 'approved') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <SafeAreaView edges={['top']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
            <Text style={{ fontFamily: Font.heading, fontSize: 17, color: '#fff', textAlign: 'center' }}>
              You need an approved kitchen to post videos.
            </Text>
          </MotiView>
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
            <PressableScale onPress={() => { feedback.tap(); router.replace('/become-prepper'); }} accessibilityRole="button" accessibilityLabel="Apply to become a prepper"
              style={{ height: 50, borderRadius: Radius.pill, backgroundColor: ORANGE, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 15, color: '#fff' }}>Apply now</Text>
            </PressableScale>
          </MotiView>
        </SafeAreaView>
      </View>
    );
  }

  async function pickThumb() {
    feedback.tap();
    setUploading(true);
    setPostErr(null);
    try {
      const url = await pickAndUploadImage('meal-videos', user?.id ?? 'anon');
      if (url) setThumb(url);
    } catch {
      feedback.error();
      setPostErr('Could not upload thumbnail. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function toggleTag(t: string) {
    feedback.tap();
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handlePost() {
    if (!caption.trim() && !thumb) return;
    feedback.tap();
    setUploading(true);
    setPostErr(null);
    try {
      const { error } = await supabase.from('feed_posts').insert({
        prepper_id: prepper!.id,
        caption: cleanBlock(caption).trim() || null,
        thumbnail_url: thumb,
        tags,
      });
      if (error) throw error;
      feedback.success();
      qc.invalidateQueries({ queryKey: ['feed'] });
      setPosted(true);
      setTimeout(() => router.replace('/dashboard'), 1200);
    } catch {
      feedback.error();
      setPostErr('Could not post. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6, gap: 12 }}>
          <PressableScale onPress={() => { feedback.tap(); if (router.canGoBack()) { router.back(); } else { router.replace('/dashboard'); } }} accessibilityRole="button" accessibilityLabel="Back"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={22} color="#fff" />
          </PressableScale>
          <Text style={{ flex: 1, fontFamily: Font.display, fontSize: 24, color: '#fff', letterSpacing: -0.6 }}>post a video</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 20 }}
          keyboardShouldPersistTaps="handled">

          {/* Thumbnail / video picker */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280 }}>
          <PressableScale onPress={pickThumb} disabled={uploading} accessibilityRole="button" accessibilityLabel="Pick a thumbnail or video"
            style={{ height: 200, borderRadius: 20, backgroundColor: CARD, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: thumb ? 'transparent' : '#2d3240', borderStyle: 'dashed' }}>
            {uploading ? (
              <ActivityIndicator color={ORANGE} />
            ) : thumb ? (
              <>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#1a1d28' }} />
                <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'timing', duration: 240 }}
                  style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: ORANGE + '28', alignItems: 'center', justifyContent: 'center' }}>
                    <Video size={24} color={ORANGE} />
                  </View>
                  <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: ORANGE }}>thumbnail selected — tap to change</Text>
                </MotiView>
              </>
            ) : (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#252a34', alignItems: 'center', justifyContent: 'center' }}>
                  <ImagePlus size={24} color={MUTED} />
                </View>
                <Text style={{ fontFamily: Font.semibold, fontSize: 13, color: MUTED }}>tap to add thumbnail or video</Text>
                <Text style={{ fontFamily: Font.body, fontSize: 12, color: '#5b6170' }}>JPG, PNG or MP4 · max 100MB</Text>
              </View>
            )}
          </PressableScale>
          </MotiView>

          {/* Caption */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 80 }}>
          <View>
            <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.textMuted, marginBottom: 8 }}>caption</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="What are you making today? 🍳"
              placeholderTextColor="#4b5563"
              multiline
              maxLength={300}
              accessibilityLabel="Video caption"
              style={{ minHeight: 90, backgroundColor: CARD, borderRadius: 16, padding: 14, fontSize: 15, fontFamily: Font.body, color: '#fff', textAlignVertical: 'top' }}
            />
            <Text style={{ fontFamily: Font.body, fontSize: 11, color: '#4b5563', textAlign: 'right', marginTop: 4 }}>{caption.length}/300</Text>
          </View>
          </MotiView>

          {/* Tags */}
          <MotiView from={{ opacity: 0, translateY: 10 }} animate={{ opacity: 1, translateY: 0 }} transition={{ type: 'timing', duration: 280, delay: 160 }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Hash size={14} color={MUTED} />
              <Text style={{ fontFamily: Font.heading, fontSize: 13.5, color: Palette.textMuted }}>tags</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <MotiView
                    key={t}
                    animate={{ backgroundColor: on ? ORANGE + '24' : CARD, borderColor: on ? ORANGE : '#2d3240' }}
                    transition={{ type: 'timing', duration: 180 }}
                    style={{ borderRadius: Radius.pill, borderWidth: 1, overflow: 'hidden' }}>
                    <PressableScale onPress={() => toggleTag(t)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={t}
                      style={{ paddingHorizontal: 13, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontFamily: Font.semibold, fontSize: 12.5, color: on ? ORANGE : MUTED }}>{t}</Text>
                    </PressableScale>
                  </MotiView>
                );
              })}
            </View>
          </View>
          </MotiView>

          {/* Post / success */}
          {postErr ? (
            <Text style={{ fontFamily: Font.body, fontSize: 13, color: Palette.danger, textAlign: 'center' }}>{postErr}</Text>
          ) : null}
          {posted ? (
            <MotiView from={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 220 }}
              style={{ height: 54, borderRadius: Radius.pill, backgroundColor: Palette.success, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>Posted! Redirecting…</Text>
            </MotiView>
          ) : (
            <PressableScale onPress={handlePost} disabled={uploading || (!caption.trim() && !thumb)}
              accessibilityRole="button" accessibilityLabel="Post video"
              style={{ height: 54, borderRadius: Radius.pill, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
                opacity: uploading || (!caption.trim() && !thumb) ? 0.5 : 1 }}>
              {uploading ? <ActivityIndicator color="#fff" /> : <Text style={{ fontFamily: Font.heading, fontSize: 16, color: '#fff' }}>post to feed</Text>}
            </PressableScale>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
