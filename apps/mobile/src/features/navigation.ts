import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { Routes } from '../app/navigation/types.ts';

export function useRoot() {
  return useNavigation<NavigationProp<Routes>>();
}
