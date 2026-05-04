import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTodos } from '../src/useTodos';
import { Category, CATEGORY_COLOR, CATEGORY_LABEL } from '../src/types';

const CATEGORIES: Category[] = ['work', 'home', 'other'];

export default function AddTodo() {
  const router = useRouter();
  const { addTodo } = useTodos();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('work');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) return;
    setSubmitting(true);
    await addTodo(title.trim(), category, note);
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.label}>タイトル</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="タスクを入力"
          placeholderTextColor="#9CA3AF"
          autoFocus
        />

        <Text style={styles.label}>カテゴリ</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCategory(c)}
                style={[
                  styles.categoryBtn,
                  { borderColor: CATEGORY_COLOR[c] },
                  active && { backgroundColor: CATEGORY_COLOR[c] },
                ]}
              >
                <Text style={[styles.categoryBtnText, { color: active ? '#fff' : CATEGORY_COLOR[c] }]}>
                  {CATEGORY_LABEL[c]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.label}>メモ（任意）</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="詳細やメモを入力"
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.submitBtn, (!title.trim() || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!title.trim() || submitting}
        >
          <Text style={styles.submitBtnText}>追加する</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    backgroundColor: '#F8F9FA',
  },
  noteInput: { height: 100, textAlignVertical: 'top' },
  categoryRow: { flexDirection: 'row', gap: 10 },
  categoryBtn: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  categoryBtnText: { fontSize: 14, fontWeight: '600' },
  submitBtn: {
    backgroundColor: '#5B5FEF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
