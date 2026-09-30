<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $schoolName }} — {{ $title }}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 24px; }
  .head { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  .head h1 { margin: 0; font-size: 19px; letter-spacing: 1.5px; text-transform: uppercase; }
  .head p { margin: 4px 0 0; font-size: 11px; color: #475569; }
  table.data { width: 100%; margin-top: 16px; border-collapse: collapse; }
  table.data th, table.data td { border: 1px solid #cbd5e1; padding: 5px 7px; }
  table.data th { background: #f1f5f9; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
  table.data td.num { text-align: right; }
  table.data tbody tr:nth-child(even) td { background: #f8fafc; }
  .foot { margin-top: 22px; font-size: 9px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>

<div class="head">
  <h1>{{ $schoolName }}</h1>
  <p>{{ $title }} &middot; Generated {{ $generatedAt }}</p>
</div>

<table class="data">
  <thead>
    <tr>
      @foreach ($headers as $header)
        <th>{{ str_replace('_', ' ', $header) }}</th>
      @endforeach
    </tr>
  </thead>
  <tbody>
    @forelse ($rows as $row)
      <tr>
        @foreach ($row as $cell)
          <td class="{{ is_numeric($cell) ? 'num' : '' }}">{{ $cell === null || $cell === '' ? '—' : $cell }}</td>
        @endforeach
      </tr>
    @empty
      <tr><td colspan="{{ count($headers) }}" style="text-align:center;color:#94a3b8">No data for this report.</td></tr>
    @endforelse
  </tbody>
</table>

<div class="foot">
  {{ $schoolName }} &middot; {{ $report }} report &middot; {{ count($rows) }} row(s)
</div>

</body>
</html>
