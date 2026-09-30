import apiClient from './client';
import type { Book, Borrowing, Paginated } from '../types';

function toList<T>(data: T[] | Paginated<T>): T[] {
  return Array.isArray(data) ? data : data.data;
}

export async function fetchBooks(q = ''): Promise<Book[]> {
  const { data } = await apiClient.get<Book[] | Paginated<Book>>('/library/books', {
    params: q ? { q } : {},
  });
  return toList(data);
}

export async function createBook(payload: Partial<Book>): Promise<Book> {
  const { data } = await apiClient.post<Book>('/library/books', payload);
  return data;
}

export async function borrowBook(bookId: number, studentId: number): Promise<void> {
  await apiClient.post(`/library/books/${bookId}/borrow`, { student_id: studentId });
}

export async function fetchBorrowings(): Promise<Borrowing[]> {
  const { data } = await apiClient.get<Borrowing[] | Paginated<Borrowing>>('/library/borrowings');
  return toList(data);
}

export async function returnBorrowing(id: number): Promise<void> {
  await apiClient.post(`/library/borrowings/${id}/return`);
}
