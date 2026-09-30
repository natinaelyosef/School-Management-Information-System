import apiClient from './client';
import type { Exam } from '../types';

export async function fetchExams(): Promise<Exam[]> {
  const { data } = await apiClient.get<Exam[]>('/exams');
  return data;
}
