<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{{ $schoolName }} — Payment Receipt</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 24px; }
  .head { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  .head h1 { margin: 0; font-size: 19px; letter-spacing: 1.5px; text-transform: uppercase; }
  .head p { margin: 4px 0 0; font-size: 11px; color: #475569; }
  .stamp { display: inline-block; margin-top: 10px; border: 2px solid #15803d; color: #15803d;
           padding: 4px 14px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; }
  table.meta { width: 100%; margin-top: 16px; border-collapse: collapse; }
  table.meta td { padding: 4px 0; vertical-align: top; }
  table.meta .lbl { font-weight: bold; width: 150px; color: #334155; }
  table.amounts { width: 100%; margin-top: 16px; border-collapse: collapse; }
  table.amounts th, table.amounts td { border: 1px solid #cbd5e1; padding: 7px 9px; }
  table.amounts th { background: #f1f5f9; text-align: left; font-size: 10px; text-transform: uppercase; }
  table.amounts td.num { text-align: right; }
  table.amounts tr.total td { background: #f8fafc; font-weight: bold; }
  .box { margin-top: 16px; border: 1px solid #cbd5e1; background: #f8fafc; padding: 10px 12px; }
  .box h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; }
  .foot { margin-top: 26px; font-size: 9px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>

<div class="head">
  <h1>{{ $schoolName }}</h1>
  <p>{{ $schoolAddress }}@if($schoolPhone) &middot; {{ $schoolPhone }}@endif@if($schoolEmail) &middot; {{ $schoolEmail }}@endif</p>
  <p>Official Payment Receipt</p>
  <div class="stamp">Verified</div>
</div>

<table class="meta">
  <tr>
    <td><span class="lbl">Receipt No</span>REC-{{ $payment->id }}</td>
    <td><span class="lbl">Payment Date</span>{{ \Carbon\Carbon::parse($payment->payment_date)->format('d M Y') }}</td>
  </tr>
  <tr>
    <td><span class="lbl">Student</span>{{ $payment->student?->full_name }}</td>
    <td><span class="lbl">Admission No</span>{{ $payment->student?->admission_no ?? '—' }}</td>
  </tr>
  <tr>
    <td><span class="lbl">Class</span>{{ trim(($payment->student?->grade?->name ?? '').($payment->student?->section ? '-'.$payment->student->section->name : ''), '-') ?: '—' }}</td>
    <td><span class="lbl">Method</span>{{ ucwords(str_replace('_', ' ', $payment->payment_method ?? '—')) }}</td>
  </tr>
  <tr>
    <td><span class="lbl">Invoice</span>{{ $payment->invoice?->invoice_no ?? '—' }}</td>
    <td><span class="lbl">Transaction Ref</span>{{ $payment->reference ?? '—' }}</td>
  </tr>
</table>

<table class="amounts">
  <thead>
    <tr><th>Description</th><th style="text-align:right">Amount (ETB)</th></tr>
  </thead>
  <tbody>
    <tr>
      <td>Payment received{{ $payment->invoice ? ' against '.$payment->invoice->invoice_no : '' }}</td>
      <td class="num">{{ number_format((float) $payment->amount, 2) }}</td>
    </tr>
    @if ($payment->invoice)
      <tr>
        <td>Invoice total</td>
        <td class="num">{{ number_format((float) $payment->invoice->total, 2) }}</td>
      </tr>
      <tr>
        <td>Previously paid</td>
        <td class="num">{{ number_format((float) ($payment->invoice->amount_paid - $payment->amount), 2) }}</td>
      </tr>
      <tr class="total">
        <td>Remaining balance</td>
        <td class="num">{{ number_format((float) $payment->invoice->balance, 2) }}</td>
      </tr>
    @endif
  </tbody>
</table>

@if ($verification)
  <div class="box">
    <h3>Verification</h3>
    <p style="margin:0 0 4px"><strong>Verified by:</strong> {{ $verification->user?->name ?? 'Finance Office' }}</p>
    <p style="margin:0 0 4px"><strong>Verified at:</strong> {{ $verification->verified_at ? \Carbon\Carbon::parse($verification->verified_at)->format('d M Y, H:i') : '—' }}</p>
    @if ($verification->comment)<p style="margin:0"><strong>Note:</strong> {{ $verification->comment }}</p>@endif
  </div>
@endif

<div class="foot">
  This receipt confirms a payment recorded by {{ $schoolName }}. Issued {{ $generatedAt }}.
</div>

</body>
</html>
