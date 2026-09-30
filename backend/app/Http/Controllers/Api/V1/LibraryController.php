<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Book;
use App\Models\BookCopy;
use App\Models\Borrowing;
use App\Models\LibraryFine;
use App\Traits\LogsActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class LibraryController extends Controller
{
    use LogsActivity;

    public const FINE_PER_DAY = 2;

    public const LOAN_DAYS = 14;

    public function books(Request $request)
    {
        $q = Book::query();

        if ($request->filled('q')) {
            $s = $request->string('q');
            $q->where(fn ($qq) => $qq
                ->where('title', 'like', "%{$s}%")
                ->orWhere('author', 'like', "%{$s}%")
                ->orWhere('isbn', 'like', "%{$s}%")
                ->orWhere('category', 'like', "%{$s}%"));
        }

        if ($request->filled('category')) {
            $q->where('category', $request->string('category'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        $q->withCount(['bookCopies as copies_count'])
            ->withCount(['bookCopies as available_copies_count' => fn ($qq) => $qq->where('status', 'available')]);

        $books = $q->orderBy('title')->paginate($request->integer('per_page', 20));

        $books->through(function (Book $book) {
            $book->setAttribute('available_count', (int) $book->available_copies_count);
        });

        return response()->json($books);
    }

    public function storeBooks(Request $request)
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'author' => 'nullable|string|max:255',
            'isbn' => 'nullable|string|max:60|unique:books,isbn',
            'publisher' => 'nullable|string|max:255',
            'published_year' => 'nullable|integer|min:0|max:2100',
            'category' => 'nullable|string|max:100',
            'total_copies' => 'nullable|integer|min:1|max:500',
            'shelf_location' => 'nullable|string|max:60',
        ]);

        $totalCopies = $data['total_copies'] ?? 1;

        $book = DB::transaction(function () use ($data, $totalCopies) {
            $book = Book::create([
                'title' => $data['title'],
                'author' => $data['author'] ?? null,
                'isbn' => $data['isbn'] ?? null,
                'publisher' => $data['publisher'] ?? null,
                'published_year' => $data['published_year'] ?? null,
                'category' => $data['category'] ?? null,
                'total_copies' => $totalCopies,
                'available_copies' => $totalCopies,
                'shelf_location' => $data['shelf_location'] ?? null,
                'status' => 'available',
            ]);

            $prefix = $book->isbn ?: strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $book->title), 0, 6) ?: 'BOOK');

            for ($i = 1; $i <= $totalCopies; $i++) {
                BookCopy::create([
                    'book_id' => $book->id,
                    'copy_code' => sprintf('%s-%s-%03d', $prefix, $book->id, $i),
                    'condition' => 'good',
                    'status' => 'available',
                ]);
            }

            return $book;
        });

        self::logActivity('library.books.create', $book, null, $book);

        return response()->json($this->withCounts($book->fresh()), 201);
    }

    public function showBook(Book $book)
    {
        return response()->json($this->withCounts($book->load('bookCopies')));
    }

    public function addCopy(Request $request, Book $book)
    {
        $data = $request->validate([
            'copy_code' => 'nullable|string|max:60|unique:book_copies,copy_code',
            'condition' => 'nullable|string|max:30',
        ]);

        $copy = BookCopy::create([
            'book_id' => $book->id,
            'copy_code' => $data['copy_code'] ?? sprintf('%s-%s-%03d', $book->isbn ?: 'BOOK', $book->id, $book->bookCopies()->count() + 1),
            'condition' => $data['condition'] ?? 'good',
            'status' => 'available',
        ]);

        $book->increment('total_copies');
        $book->increment('available_copies');

        self::logActivity('library.books.copy', $copy, null, $copy);

        return response()->json($copy, 201);
    }

    public function borrow(Request $request, Book $book)
    {
        $data = $request->validate([
            'student_id' => 'required|exists:students,id',
        ]);

        $borrowing = DB::transaction(function () use ($book, $data, $request) {
            $copy = BookCopy::where('book_id', $book->id)
                ->where('status', 'available')
                ->orderBy('id')
                ->first();

            if (! $copy) {
                abort(422, 'No available copies of this book.');
            }

            $borrowing = Borrowing::create([
                'book_copy_id' => $copy->id,
                'book_id' => $book->id,
                'student_id' => $data['student_id'],
                'user_id' => $request->user()->id,
                'borrowed_at' => now(),
                'due_at' => now()->addDays(self::LOAN_DAYS),
                'status' => 'issued',
            ]);

            $copy->update(['status' => 'borrowed']);
            $book->update([
                'available_copies' => max(0, (int) $book->available_copies - 1),
            ]);

            return $borrowing;
        });

        self::logActivity('library.borrow', $borrowing, null, $borrowing);

        $fresh = $borrowing->load(['book', 'bookCopy', 'student']);
        $fresh->setAttribute('due_date', $fresh->due_at);

        return response()->json($fresh, 201);
    }

    public function borrowings(Request $request)
    {
        $q = Borrowing::with(['book', 'bookCopy', 'student']);

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }
        if ($request->filled('book_id')) {
            $q->where('book_id', $request->integer('book_id'));
        }

        return response()->json($q->latest('borrowed_at')->paginate($request->integer('per_page', 20)));
    }

    public function showBorrowing(Borrowing $borrowing)
    {
        return response()->json($borrowing->load(['book', 'bookCopy', 'student', 'fines']));
    }

    public function returnBorrowing(Borrowing $borrowing)
    {
        if ($borrowing->status === 'returned') {
            return response()->json(['message' => 'Borrowing already returned.'], 422);
        }

        $fine = DB::transaction(function () use ($borrowing) {
            $now = now();
            $borrowing->update([
                'status' => 'returned',
                'returned_at' => $now,
            ]);

            if ($borrowing->bookCopy) {
                $borrowing->bookCopy->update(['status' => 'available']);
            }

            if ($borrowing->book) {
                $borrowing->book->update([
                    'available_copies' => min(
                        (int) $borrowing->book->total_copies,
                        (int) $borrowing->book->available_copies + 1
                    ),
                ]);
            }

            $daysOverdue = 0;

            if ($borrowing->due_at) {
                $dueDay = Carbon::parse($borrowing->due_at)->startOfDay();
                $today = now()->startOfDay();

                if ($today->greaterThan($dueDay)) {
                    $daysOverdue = (int) floor(($today->timestamp - $dueDay->timestamp) / 86400);
                }
            }

            $fine = null;

            if ($daysOverdue > 0) {
                $fine = LibraryFine::create([
                    'borrowing_id' => $borrowing->id,
                    'student_id' => $borrowing->student_id,
                    'user_id' => $borrowing->user_id,
                    'amount' => $daysOverdue * self::FINE_PER_DAY,
                    'reason' => "Overdue by {$daysOverdue} day(s)",
                    'status' => 'unpaid',
                ]);
            }

            return ['fine' => $fine, 'days_overdue' => $daysOverdue];
        });

        self::logActivity('library.return', $borrowing, null, $borrowing->fresh());

        $fresh = $borrowing->fresh()->load(['book', 'bookCopy', 'student', 'fines']);
        $fresh->setAttribute('days_overdue', $fine['days_overdue']);
        $fresh->setAttribute('fine', $fine['fine']);

        return response()->json($fresh);
    }

    public function fines(Request $request)
    {
        $q = LibraryFine::with(['borrowing.book', 'student']);

        if ($request->filled('student_id')) {
            $q->where('student_id', $request->integer('student_id'));
        }
        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->latest()->paginate($request->integer('per_page', 20)));
    }

    protected function withCounts(Book $book): Book
    {
        $book->setAttribute('copies_count', $book->bookCopies()->count());
        $book->setAttribute(
            'available_copies_count',
            $book->bookCopies()->where('status', 'available')->count()
        );
        $book->setAttribute('available_count', $book->bookCopies()->where('status', 'available')->count());

        return $book;
    }
}
