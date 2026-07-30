import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@ec/design-tokens';
import { processVoice, speak } from '../../lib/voice';

export default function SpeakScreen() {
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAsk() {
    if (!transcript.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const result = await processVoice(transcript.trim());
      setResponse(result.response);
      speak(result.response);
    } catch {
      setResponse("Sorry, I couldn't understand that. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.iconWrap}>
        <Ionicons name="mic" size={40} color={colors.accent.main} />
      </View>
      <Text style={styles.heading}>What do you need?</Text>
      <Text style={styles.subtext}>Type your question below, like "when is my next appointment?"</Text>

      <TextInput
        style={styles.input}
        value={transcript}
        onChangeText={setTranscript}
        placeholder="Type here..."
        placeholderTextColor={colors.disabled}
        multiline
        accessibilityLabel="What do you need"
      />

      <TouchableOpacity
        style={[styles.button, (loading || !transcript.trim()) && styles.buttonDisabled]}
        onPress={handleAsk}
        disabled={loading || !transcript.trim()}
        accessibilityRole="button"
      >
        {loading ? <ActivityIndicator color={colors.surface} /> : <Text style={styles.buttonText}>Ask EC</Text>}
      </TouchableOpacity>

      {response && (
        <View style={styles.responseCard}>
          <Text style={styles.responseText}>{response}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.xl, alignItems: 'center' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accent.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtext: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing['2xl'],
    lineHeight: 22,
  },
  input: {
    width: '100%',
    minHeight: 100,
    fontSize: 18,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
    backgroundColor: colors.accent.main,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { fontSize: 20, fontWeight: '700', color: colors.surface },
  responseCard: {
    width: '100%',
    marginTop: spacing['2xl'],
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.light,
  },
  responseText: { fontSize: 18, color: colors.text, lineHeight: 26 },
});
