import { View, Text, Switch, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useState } from 'react';

export default function Settings() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  function toggleNotifications(value: boolean) {
    if (value) {
      Alert.alert(
        '通知を許可',
        'AIがタスクを完了したときに通知を受け取りますか？',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '許可', onPress: () => setNotificationsEnabled(true) },
        ]
      );
    } else {
      setNotificationsEnabled(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>通知</Text>
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>プッシュ通知</Text>
            <Text style={styles.rowDesc}>AIがタスクを完了した際に通知</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#E5E7EB', true: '#5B5FEF' }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI連携</Text>
        <View style={styles.row}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>Slack</Text>
            <Text style={styles.rowDesc}>未接続</Text>
          </View>
          <TouchableOpacity style={styles.connectBtn}>
            <Text style={styles.connectBtnText}>接続</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.row, { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}>
          <View style={styles.rowBody}>
            <Text style={styles.rowTitle}>X (Twitter)</Text>
            <Text style={styles.rowDesc}>投稿案を自動生成</Text>
          </View>
          <TouchableOpacity style={styles.connectBtn}>
            <Text style={styles.connectBtnText}>接続</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アプリ情報</Text>
        <View style={styles.row}>
          <Text style={styles.rowTitle}>バージョン</Text>
          <Text style={styles.rowDesc}>1.0.0</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 16 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  rowDesc: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  connectBtn: {
    borderWidth: 1,
    borderColor: '#5B5FEF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  connectBtnText: { color: '#5B5FEF', fontSize: 13, fontWeight: '600' },
});
