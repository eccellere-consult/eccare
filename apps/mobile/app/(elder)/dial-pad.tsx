import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@ec/design-tokens';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export default function DialPadScreen() {
  const [number, setNumber] = useState('');

  function press(key: string) {
    setNumber((prev) => (prev + key).slice(0, 15));
  }

  function backspace() {
    setNumber((prev) => prev.slice(0, -1));
  }

  function call() {
    if (!number) return;
    Linking.openURL(`tel:${number}`);
  }

  return (
    <View style={styles.container}>
      <View style={styles.display}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {number || 'Enter a number'}
        </Text>
        {number.length > 0 && (
          <TouchableOpacity onPress={backspace} accessibilityLabel="Delete" accessibilityRole="button">
            <Ionicons name="backspace-outline" size={30} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.keypad}>
        {KEYS.map((key) => (
          <TouchableOpacity
            key={key}
            style={styles.key}
            activeOpacity={0.6}
            onPress={() => press(key)}
            accessibilityRole="button"
            accessibilityLabel={`Key ${key}`}
          >
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.callButton, !number && styles.callButtonDisabled]}
        onPress={call}
        disabled={!number}
        accessibilityRole="button"
        accessibilityLabel="Call"
      >
        <Ionicons name="call" size={32} color={colors.surface} />
      </TouchableOpacity>
    </View>
  );
}

const KEY_SIZE = 84;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.xl, alignItems: 'center' },
  display: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    width: '100%',
    minHeight: 64,
    marginVertical: spacing['2xl'],
  },
  displayText: { fontSize: 36, fontWeight: '700', color: colors.text, letterSpacing: 2 },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    maxWidth: KEY_SIZE * 3 + spacing.lg * 2 + 4,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 32, fontWeight: '700', color: colors.text },
  callButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success.main,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
  },
  callButtonDisabled: { opacity: 0.4 },
});
