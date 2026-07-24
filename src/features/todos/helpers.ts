import type { NotesTodo } from '@/types/database';

const SHOPPING_GROUP_KEYWORDS = ['einkauf', 'shopping', 'grocer', 'grocery', 'supermarkt', 'market'];

export function isShoppingGroupName(name: string): boolean {
  const lower = name.toLowerCase();
  return SHOPPING_GROUP_KEYWORDS.some((kw) => lower.includes(kw));
}

/** Matches isShoppingTodoItem() in the legacy app — no explicit flag, inferred from group name/category/quantity. */
export function isShoppingItem(item: NotesTodo): boolean {
  return item.item_type === 'todo' && !item.is_done && (isShoppingGroupName(item.group_name) || !!item.category || !!item.quantity);
}

export const UNIT_OPTIONS = ['', 'Stk', 'g', 'kg', 'ml', 'l', 'Pack'];

export const CATEGORY_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: '', label: 'Keine', icon: '·' },
  { value: 'produce', label: 'Obst & Gemüse', icon: '🥦' },
  { value: 'dairy', label: 'Milchprodukte', icon: '🧀' },
  { value: 'pantry', label: 'Vorrat', icon: '🥫' },
  { value: 'household', label: 'Haushalt', icon: '🏠' },
  { value: 'other', label: 'Sonstiges', icon: '🧺' },
];

export function categoryIcon(category: string | null): string {
  return CATEGORY_OPTIONS.find((c) => c.value === (category ?? ''))?.icon ?? '🧺';
}

export function formatQuantity(item: NotesTodo): string {
  if (!item.quantity) return '';
  const isWhole = Number.isInteger(item.quantity);
  const qty = isWhole ? String(item.quantity) : item.quantity.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return `${qty} ${item.unit ?? ''}`.trim();
}

export const WORKFLOW_LABELS: Record<string, string> = {
  open: 'Offen',
  in_progress: 'Ich kümmere mich',
  waiting: 'Wartet',
};

export const WORKFLOW_ORDER = ['open', 'in_progress', 'waiting'];
