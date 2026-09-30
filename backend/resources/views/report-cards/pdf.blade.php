<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $schoolName }} — Report Card — {{ $card->student->first_name }} {{ $card->student->last_name }}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: DejaVu Sans, sans-serif;
    font-size: 11px;
    color: #1e293b;
    margin: 0;
    padding: 24px;
  }
  .head { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  .head h1 { margin: 0; font-size: 19px; letter-spacing: 1.5px; text-transform: uppercase; }
  .head p { margin: 4px 0 0; font-size: 11px; color: #475569; }
  .meta { width: 100%; margin-top: 14px; border-collapse: collapse; }
  .meta td { padding: 4px 0; vertical-align: top; }
  .meta .lbl { font-weight: bold; width: 110px; color: #334155; }
  table.grades { width: 100%; margin-top: 16px; border-collapse: collapse; }
  table.grades th, table.grades td { border: 1px solid #cbd5e1; padding: 6px 8px; }
  table.grades th { background: #f1f5f9; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: .5px; }
  table.grades td.num { text-align: right; }
  table.grades tr.total td { background: #f8fafc; font-weight: bold; }
  .box { margin-top: 16px; border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px 12px; }
  .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .two { width: 100%; border-collapse: collapse; margin-top: 16px; }
  .two td { width: 50%; vertical-align: top; padding-right: 12px; }
  .two td + td { padding-right: 0; padding-left: 12px; }
  .stat { border: 1px solid #cbd5e1; padding: 8px 10px; min-height: 54px; }
  .stat .k { font-size: 9px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
  .stat .v { font-size: 16px; font-weight: bold; margin-top: 2px; }
  .sign { width: 100%; border-collapse: collapse; margin-top: 40px; }
  .sign td { width: 50%; padding-top: 30px; }
  .sign .line { border-top: 1px solid #0f172a; padding-top: 4px; font-size: 10px; }
  .foot { margin-top: 24px; font-size: 9px; color: #94a3b8; text-align: center; }
  .grade-A { color: #15803d; font-weight: bold; }
  .grade-B { color: #1d4ed8; font-weight: bold; }
  .grade-C { color: #a16207; font-weight: bold; }
  .grade-D, .grade-F { color: #b91c1c; font-weight: bold; }
</style>
</head>
<body>

<div class="head">
  <h1>{{ $schoolName }}</h1>
  <p>{{ $schoolAddress }}</p>
  <p>Student Report Card — {{ $termName }}</p>
</div>

<table class="meta">
  <tr>
    <td><span class="lbl">Student</span>{{ $card->student->first_name }} {{ $card->student->last_name }}</td>
    <td><span class="lbl">Admission No</span>{{ $card->student->admission_no }}</td>
  </tr>
  <tr>
    <td><span class="lbl">Class</span>{{ $className }}</td>
    <td><span class="lbl">Gender</span>{{ ucfirst($card->student->gender ?? '—') }}</td>
  </tr>
  <tr>
    <td><span class="lbl">Academic Year</span>{{ $academicYear }}</td>
    <td><span class="lbl">Date of Birth</span>{{ $card->student->dob ? \Carbon\Carbon::parse($card->student->dob)->format('d M Y') : '—' }}</td>
  </tr>
</table>

<table class="grades">
  <thead>
    <tr>
      <th style="width:40%">Subject</th>
      <th style="text-align:right">Marks</th>
      <th style="text-align:right">Percentage</th>
      <th style="text-align:right">Grade</th>
    </tr>
  </thead>
  <tbody>
    @forelse ($subjects as $line)
      <tr>
        <td>{{ $line['subject'] }}</td>
        <td class="num">{{ rtrim(rtrim(number_format((float) $line['obtained'], 2), '0'), '.') }} / {{ rtrim(rtrim(number_format((float) $line['possible'], 2), '0'), '.') }}</td>
        <td class="num">{{ $line['percentage'] !== null ? number_format((float) $line['percentage'], 2) . '%' : '—' }}</td>
        <td class="num grade-{{ $line['grade'] ?? '-' }}">{{ $line['grade'] ?? '—' }}</td>
      </tr>
    @empty
      <tr><td colspan="4" style="text-align:center;color:#94a3b8">No subject marks recorded for this term.</td></tr>
    @endforelse
    <tr class="total">
      <td>Overall Average</td>
      <td class="num">—</td>
      <td class="num">{{ $card->overall_average !== null ? number_format((float) $card->overall_average, 2) . '%' : '—' }}</td>
      <td class="num">{{ $card->overall_grade ?? '—' }}</td>
    </tr>
  </tbody>
</table>

<table class="two">
  <tr>
    <td>
      <div class="stat">
        <div class="k">Attendance</div>
        <div class="v">{{ $card->attendance_rate !== null ? number_format((float) $card->attendance_rate, 1) . '%' : '—' }}</div>
      </div>
    </td>
    <td>
      <div class="stat">
        <div class="k">Class Rank</div>
        <div class="v">{{ $card->rank_in_class !== null && $card->total_students ? $card->rank_in_class . ' / ' . $card->total_students : '—' }}</div>
      </div>
    </td>
  </tr>
</table>

@if ($card->teacher_comment || $card->principal_comment)
  <div class="box">
    <h3>Remarks</h3>
    @if ($card->teacher_comment)
      <p style="margin:0 0 6px"><strong>Teacher:</strong> {{ $card->teacher_comment }}</p>
    @endif
    @if ($card->principal_comment)
      <p style="margin:0"><strong>Principal:</strong> {{ $card->principal_comment }}</p>
    @endif
  </div>
@endif

<table class="sign">
  <tr>
    <td><div class="line">Class Teacher Signature</div></td>
    <td><div class="line">Principal Signature</div></td>
  </tr>
</table>

<div class="foot">
  Issued {{ $generatedAt }} &middot; {{ $schoolName }}@if($schoolPhone) &middot; {{ $schoolPhone }}@endif
</div>

</body>
</html>
