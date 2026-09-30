import apiClient from './client';
import type { Paginated, Teacher } from '../types';

export async function fetchTeachers(page = 1): Promise<Paginated<Teacher>> {
  const { data } = await apiClient.get<Paginated<Teacher>>('/teachers', {
    params: { page },
  });
  return data;
}
