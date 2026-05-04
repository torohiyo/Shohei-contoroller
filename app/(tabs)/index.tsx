import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTodos } from '../../src/useTodos';
import { Category, CATEGORY_COLOR, CATEGORY_LABEL, Todo } from '../../src/types';

type Filter = 'all' | Category;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'すべて' },
  { key: 'work', label: '仕事' },
  { key: 'home', label: '家事' },
  { key: 'other', label: 'その他' },
];

export default function TodoList() {
  const router = useRouter();
  const { todos, loading, toggleTodo, deleteTodo } = useTodos();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = filter === 'all' ? todos : todos.filter((t) => t.category === filter);
  const pending = filtered.filter((t) => t.status === 'pending');
  const completed = filtered.filter((t) => t.status === 'completed');

  function confirmDelete(id: string) {
    Alert.alert('削除', 'このタスクを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => deleteTodo(id) },
    ]);
  }

  function renderItem({ item }: { item: Todo }) {
    const done = item.status === 'completed';
    return (
      <View style={styles.item}>
        <TouchableOpacity onPress={() => toggleTodo(item.id)} style={styles.checkbox}>
          <Ionicons
            name={done ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={done ? '#10B981' : '#D1D5DB'}
          />
        </TouchableOpacity>
        <View style={styles.itemBody}>
          <Text style={[styles.itemTitle, done && styles.itemTitleDone]}>{item.title}</Text>
          {item.note ? (
            <Text style={styles.itemNote} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>
        <View
          style={[styles.categoryTag, { backgroundColor: CATEGORY_COLOR[item.category] + '1A' }]}
        >
          <Text style={[styles.categoryText, { color: CATEGORY_COLOR[item.category] }]}>
            {CATEGORY_LABEL[item.category]}
          </Text>
        </View>
        <TouchableOpacity onPress={() => confirmDelete(item.id)} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color="#D1D5DB" />
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) return <View style={styles.container} />;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={[...pending, ...completed]}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>タスクはありません</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add')}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  filterRow: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  filterContent: { paddingHorizontal: 16, alignItems: 'center', gap: 8 },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterBtnActive: { backgroundColor: '#5B5FEF' },
  filterLabel: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  filterLabelActive: { color: '#fff' },
  list: { padding: 16, gap: 0 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 12,
  },
  checkbox: { width: 28, alignItems: 'center' },
  itemBody: { flex: 1 },
  itemTitle: { fontSize: 15, color: '#1A1A2E', fontWeight: '500' },
  itemTitleDone: { color: '#9CA3AF', textDecorationLine: 'line-through' },
  itemNote: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  categoryTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 12, fontWeight: '600' },
  deleteBtn: { padding: 4 },
  separator: { height: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: '#9CA3AF', fontSize: 15 },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#5B5FEF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5B5FEF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
