<?php

namespace App\Services;

use Illuminate\Http\Response;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Common\Entity\Style\Style;
use OpenSpout\Writer\XLSX\Options;
use OpenSpout\Writer\XLSX\Writer;

/**
 * Streams tabular data as a real .xlsx workbook so staff can open reports in
 * Excel/LibreOffice/Sheets, with a styled header and numeric cells kept numeric.
 */
class ExportService
{
    /**
     * @param  array<int, string>  $headers
     * @param  iterable<int, array<int, mixed>>  $rows
     */
    public function xlsx(string $filename, array $headers, iterable $rows, ?string $title = null): Response
    {
        $options = new Options;
        $options->SHOULD_CREATE_NEW_SHEETS_AUTOMATICALLY = false;
        $options->setTempFolder(sys_get_temp_dir());

        $writer = new Writer($options);
        $writer->setCreator((string) config('app.name'));

        $tempPath = tempnam(sys_get_temp_dir(), 'smis_export_');
        $writer->openToFile($tempPath);

        if ($title) {
            $writer->addRow(Row::fromValues([$title], (new Style)->setFontBold()->setFontSize(14)));
            $writer->addRow(Row::fromValues([]));
        }

        $writer->addRow(Row::fromValues(
            $headers,
            (new Style)->setFontBold()->setBackgroundColor('EEEEEE')
        ));

        foreach ($rows as $row) {
            $writer->addRow(Row::fromValues(array_map(
                fn ($value) => $this->scalar($value),
                array_values($row)
            )));
        }

        $writer->close();

        $content = (string) file_get_contents($tempPath);
        @unlink($tempPath);

        $downloadName = str_ends_with($filename, '.xlsx') ? $filename : $filename.'.xlsx';

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="'.$downloadName.'"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Report rows are scalars, but guard against model/collection leaks so a
     * malformed row fails loudly here rather than corrupting the workbook.
     */
    protected function scalar(mixed $value): null|bool|float|int|string
    {
        return match (true) {
            $value === null => null,
            is_bool($value) => $value,
            is_int($value) => $value,
            is_float($value) => $value,
            is_numeric($value) => $value + 0,
            is_string($value) => $value,
            $value instanceof \Stringable => (string) $value,
            default => json_encode($value),
        };
    }
}
