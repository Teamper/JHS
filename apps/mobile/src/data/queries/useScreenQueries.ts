import { useCallback } from 'react';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

export function useScreenQuery(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  useFocusEffect(useCallback(() => () => {
    void queryClient.cancelQueries({ queryKey, exact: true });
  }, [queryClient, queryKey]));
  return useIsFocused();
}
