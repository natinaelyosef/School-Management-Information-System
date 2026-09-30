import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '../../components/ui/Table';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { borrowBook, createBook, fetchBorrowings, fetchBooks, returnBorrowing } from '../../api/library';
import { fetchStudents } from '../../api/students';
import { apiErrorMessage } from '../../utils/errors';
import { formatCurrency, formatDate } from '../../utils/format';
import type { Book, Borrowing, Student } from '../../types';
import { useTranslation } from 'react-i18next';

function isOverdue(b: Borrowing): boolean {
  if (b.returned_at) return false;
  if (b.status === 'overdue') return true;
  return Boolean(b.due_date && b.due_date < new Date().toISOString().slice(0, 10));
}

export default function LibraryPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');

  const booksQuery = useQuery({
    queryKey: ['library-books', search],
    queryFn: () => fetchBooks(search),
    retry: false,
  });
  const borrowingsQuery = useQuery({
    queryKey: ['library-borrowings'],
    queryFn: fetchBorrowings,
    retry: false,
  });
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => fetchStudents(1),
    retry: false,
  });

  const books = booksQuery.data ?? [];
  const borrowings = borrowingsQuery.data ?? [];
  const students: Student[] = studentsQuery.data?.data ?? [];

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [borrowTarget, setBorrowTarget] = useState<Book | null>(null);
  const [studentId, setStudentId] = useState(String(students[0]?.id ?? ''));
  const borrowStudentId = studentId || String(students[0]?.id ?? '');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', author: '', isbn: '', total_copies: '3' });

  const refreshBooks = () => queryClient.invalidateQueries({ queryKey: ['library-books'] });
  const refreshBorrowings = () => queryClient.invalidateQueries({ queryKey: ['library-borrowings'] });

  const searchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(q.trim());
  };

  const borrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowTarget) return;
    setBusy(true);
    setError('');
    try {
      await borrowBook(borrowTarget.id, Number(borrowStudentId));
      await refreshBooks();
      await refreshBorrowings();
      setBorrowTarget(null);
      setNotice(`Copy issued to ${students.find((s) => String(s.id) === borrowStudentId)?.first_name ?? 'student'}.`);
    } catch (err) {
      setError(apiErrorMessage(err, 'Backend unreachable — the borrowing was not recorded.'));
    } finally {
      setBusy(false);
    }
  };

  const addBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await createBook({
        title: form.title,
        author: form.author,
        isbn: form.isbn,
        total_copies: Number(form.total_copies) || 1,
        available_copies: Number(form.total_copies) || 1,
      });
      await refreshBooks();
      setAddOpen(false);
      setForm({ title: '', author: '', isbn: '', total_copies: '3' });
      setNotice('Book added to the catalogue.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Backend unreachable — the book was not saved.'));
    } finally {
      setBusy(false);
    }
  };

  const returnBook = async (borrowing: Borrowing) => {
    setNotice('');
    try {
      await returnBorrowing(borrowing.id);
      await refreshBorrowings();
      await refreshBooks();
      setNotice('Book returned.');
    } catch (err) {
      setNotice(apiErrorMessage(err, 'Backend unreachable — the return was not recorded.'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.library.title')}</h1>
        <Button onClick={() => setAddOpen(true)}>+ Add Book</Button>
      </div>

      {(booksQuery.isError || borrowingsQuery.isError) && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(booksQuery.error ?? borrowingsQuery.error, 'The library data could not be loaded.')}
        </p>
      )}
      {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p className="rounded-lg bg-green-50 dark:bg-green-950/40 p-3 text-sm text-green-800 dark:text-green-200">{notice}</p>}

      <form onSubmit={searchSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search books by title, author or ISBN…"
          />
        </div>
        <Button type="submit" variant="outline">Search</Button>
      </form>

      <Table<Book>
        columns={[
          { key: 'title', header: t('common.title') },
          { key: 'author', header: 'Author', render: (r) => r.author ?? '—' },
          { key: 'isbn', header: 'ISBN', render: (r) => r.isbn ?? '—' },
          {
            key: 'available_copies',
            header: 'Copies',
            render: (r) => (
              <span className="font-semibold">
                <span className={(r.available_copies ?? 0) > 0 ? 'text-green-700 dark:text-green-300 dark:text-green-300 dark:text-green-300' : 'text-red-600 dark:text-red-400 dark:text-red-400 dark:text-red-400'}>
                  {r.available_copies ?? 0}
                </span>
                {' / '}{r.total_copies ?? 0}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            render: (r) => (
              <Button
                size="sm"
                onClick={() => { setStudentId(String(students[0]?.id ?? '')); setBorrowTarget(r); }}
                disabled={(r.available_copies ?? 0) <= 0}
              >
                Borrow
              </Button>
            ),
          },
        ]}
        rows={books.filter((b) =>
          `${b.title} ${b.author ?? ''} ${b.isbn ?? ''}`.toLowerCase().includes(search.toLowerCase()),
        )}
        emptyText={
          booksQuery.isPending
            ? 'Loading books…'
            : booksQuery.isError
              ? 'No books loaded.'
              : search
                ? 'No books match your search.'
                : 'No books yet.'
        }
      />

      <Card title="My Borrowings" subtitle="Active loans and returns — overdue fines apply">
        <Table<Borrowing>
          columns={[
            { key: 'book_title', header: 'Book', render: (r) => r.book_title ?? `Book #${r.book_id}` },
            { key: 'student_name', header: 'Student', render: (r) => r.student_name ?? `Student #${r.student_id}` },
            { key: 'borrowed_at', header: 'Borrowed', render: (r) => (r.borrowed_at ? formatDate(r.borrowed_at) : '—') },
            { key: 'due_date', header: 'Due', render: (r) => (r.due_date ? formatDate(r.due_date) : '—') },
            {
              key: 'status',
              header: t('common.status'),
              render: (r) => {
                if (r.returned_at || r.status === 'returned') return <Badge tone="green">returned</Badge>;
                if (isOverdue(r)) {
                  return (
                    <span className="inline-flex items-center gap-1">
                      <Badge tone="red">overdue</Badge>
                      {(r.fine ?? 0) > 0 && <Badge tone="yellow">{formatCurrency(r.fine ?? 0)}</Badge>}
                    </span>
                  );
                }
                return <Badge tone="blue">borrowed</Badge>;
              },
            },
            {
              key: 'actions',
              header: '',
              render: (r) =>
                r.returned_at || r.status === 'returned' ? (
                  <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => returnBook(r)}>
                    Return
                  </Button>
                ),
            },
          ]}
          rows={borrowings}
          emptyText={
            borrowingsQuery.isPending
              ? 'Loading borrowings…'
              : borrowingsQuery.isError
                ? 'No borrowings loaded.'
                : 'No borrowings yet.'
          }
        />
      </Card>

      <Modal open={Boolean(borrowTarget)} title={`Borrow — ${borrowTarget?.title ?? ''}`} onClose={() => setBorrowTarget(null)}>
        <form onSubmit={borrow} className="space-y-3">
          <Select label="Student" value={borrowStudentId} onChange={(e) => setStudentId(e.target.value)} disabled={students.length === 0}>
            {students.length === 0 && <option value="">—</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} — {s.grade_level}
              </option>
            ))}
          </Select>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loan period: 14 days • Overdue fine: ETB 5/day</p>
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBorrowTarget(null)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy || !borrowStudentId}>{busy ? 'Issuing…' : 'Confirm Borrow'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={addOpen} title="Add Book" onClose={() => setAddOpen(false)}>
        <form onSubmit={addBook} className="space-y-3">
          <Input label={t('common.title')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <Input label="ISBN" value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
          </div>
          <Input label="Total copies" type="number" min={1} value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} />
          {error && <p className="rounded-lg bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add Book'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
