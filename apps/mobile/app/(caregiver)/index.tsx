import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '@ec/design-tokens';
import type { FamilyRelation } from '@ec/shared-types';
import { api } from '../../lib/api';

interface DashboardData {
  elder: { id: string; name: string; phone?: string } | null;
  recentSos: { id: string; status: string; createdAt: string }[];
  todayReminders: { id: string; status: string; medication: { name: string } }[];
}

export default function CaregiverCompanion() {
  const [relations, setRelations] = useState<FamilyRelation[]>([]);
  const [selectedElderId, setSelectedElderId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const members: FamilyRelation[] = await api.get('/family/members');
      const accepted = members.filter((r) => r.inviteStatus === 'accepted');
      setRelations(accepted);

      const elderId = selectedElderId && accepted.some((r) => r.elderUserId === selectedElderId)
        ? selectedElderId
        : accepted[0]?.elderUserId ?? null;
      setSelectedElderId(elderId);

      if (elderId) {
        const data: DashboardData = await api.get(`/family/dashboard/${elderId}`);
        setDashboard(data);
      } else {
        setDashboard(null);
      }
    } catch {
      setRelations([]);
      setDashboard(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function handleCall() {
    const phone = dashboard?.elder?.phone;
    if (!phone || !dashboard?.elder) return;
    Alert.alert(`Call ${dashboard.elder.name}?`, `Dial ${phone}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, Call', onPress: () => Linking.openURL(`tel:${phone}`) },
    ]);
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary.main} />
      </View>
    );
  }

  if (relations.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.emptyContent}>
        <View style={styles.emptyIconWrap}>
          <Ionicons name="people" size={40} color={colors.primary.main} />
        </View>
        <Text style={styles.emptyText}>
          No elder linked to your account yet.{'\n'}Set this up from the EC website — sign in and send an invite from your Family portal.
        </Text>
      </ScrollView>
    );
  }

  const latestSos = dashboard?.recentSos?.[0];
  const takenCount = dashboard?.todayReminders?.filter((r) => r.status === 'taken').length ?? 0;
  const totalReminders = dashboard?.todayReminders?.length ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
    >
      {relations.length > 1 && (
        <View style={styles.elderPicker}>
          {relations.map((r) => (
            <TouchableOpacity
              key={r.elderUserId}
              style={[styles.elderChip, r.elderUserId === selectedElderId && styles.elderChipActive]}
              onPress={() => setSelectedElderId(r.elderUserId)}
            >
              <Text style={[styles.elderChipText, r.elderUserId === selectedElderId && styles.elderChipTextActive]}>
                {r.elderUser?.name ?? 'Elder'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.statusCard}>
        <View style={styles.statusIconWrap}>
          <Ionicons name="person" size={26} color={colors.primary.main} />
        </View>
        <View style={styles.statusInfo}>
          <Text style={styles.elderName}>{dashboard?.elder?.name ?? 'Your Elder'}</Text>
          <Text style={styles.statusText}>
            {latestSos && latestSos.status !== 'resolved' ? 'Recent SOS alert' : 'No alerts today'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.callButton, !dashboard?.elder?.phone && styles.callButtonDisabled]}
          onPress={handleCall}
          disabled={!dashboard?.elder?.phone}
          accessibilityLabel="Call elder"
        >
          <Ionicons name="call" size={20} color={colors.surface} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Today</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Medicines</Text>
          <Text style={styles.summaryValue}>
            {totalReminders === 0 ? 'No reminders set' : `${takenCount} of ${totalReminders} taken`}
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>SOS Alerts</Text>
          <Text style={[styles.summaryValue, { color: latestSos && latestSos.status !== 'resolved' ? colors.emergency.main : colors.success.main }]}>
            {latestSos && latestSos.status !== 'resolved' ? 'Needs attention' : 'All clear'}
          </Text>
        </View>
      </View>

      {(dashboard?.recentSos?.length ?? 0) > 0 && (
        <>
          <Text style={styles.sectionTitle}>Recent SOS History</Text>
          <View style={styles.summaryCard}>
            {dashboard!.recentSos.slice(0, 5).map((sos) => (
              <View key={sos.id} style={styles.sosRow}>
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={18}
                  color={sos.status === 'resolved' ? colors.success.main : colors.emergency.main}
                />
                <Text style={styles.sosText}>
                  {new Date(sos.createdAt).toLocaleString()} — {sos.status}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.xl, gap: spacing.xl },
  emptyContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing['3xl'] },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: { fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24 },
  elderPicker: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  elderChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elderChipActive: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  elderChipText: { fontSize: 14, fontWeight: '600', color: colors.text },
  elderChipTextActive: { color: colors.surface },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary.light,
    borderWidth: 1,
    borderColor: colors.primary.tint,
  },
  statusIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: { flex: 1 },
  elderName: { fontSize: 20, fontWeight: '700', color: colors.text },
  statusText: { fontSize: 15, color: colors.textSecondary, marginTop: 2 },
  callButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButtonDisabled: { opacity: 0.4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  summaryCard: {
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  summaryLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  summaryValue: { fontSize: 15, color: colors.textSecondary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  sosRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  sosText: { fontSize: 14, color: colors.textSecondary },
});
