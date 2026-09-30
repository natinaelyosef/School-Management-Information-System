import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { createPreschoolAssessment, fetchPreschoolAssessments } from '../../api/academics';
import { fetchStudents } from '../../api/students';
import { apiErrorMessage } from '../../utils/errors';
import type { SkillRating, Student } from '../../types';
import { useTranslation } from 'react-i18next';

const SKILLS = [
  'Fine Motor',
  'Gross Motor',
  'Language & Communication',
  'Numeracy',
  'Social-Emotional',
  'Creativity & Music',
];

const RATINGS: SkillRating[] = ['Excellent', 'Good', 'Developing', 'Needs Support'];

const RATING_STYLES: Record<SkillRating, string> = {
  Excellent: 'bg-green-600 text-white',
  Good: 'bg-blue-600 text-white',
  Developing: 'bg-yellow-500 text-white',
  'Needs Support': 'bg-red-500 text-white',
};

export default function PreschoolAssessPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const studentsQuery = useQuery({
    queryKey: ['students'],
    queryFn: () => fetchStudents(1),
    retry: false,
  });
  const students: Student[] = studentsQuery.data?.data ?? [];
  const assessmentsQuery = useQuery({
    queryKey: ['preschool-assessments'],
    queryFn: () => fetchPreschoolAssessments(),
    retry: false,
  });
  const assessments = assessmentsQuery.data ?? [];

  const [studentId, setStudentId] = useState(String(students[0]?.id ?? ''));
  const [ratings, setRatings] = useState<Record<string, SkillRating>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const activeStudentId = studentId || String(students[0]?.id ?? '');

  // Seed defaults from the loaded assessments, and reseed only when the student
  // or the assessment CONTENT actually changes. Keying on content (not on
  // `dataUpdatedAt`) matters because a background refetch that returns identical
  // data must not wipe ratings the user is still editing.
  const seedKey = `${activeStudentId}|${assessments
    .map((a) => `${a.student_id}:${a.skill}:${a.rating}`)
    .sort()
    .join('|')}`;
  const [seededFor, setSeededFor] = useState(seedKey);
  if (seededFor !== seedKey) {
    const next: Record<string, SkillRating> = {};
    for (const skill of SKILLS) next[skill] = 'Developing';
    for (const row of assessments) {
      if (String(row.student_id) === activeStudentId && row.skill) next[row.skill] = row.rating;
    }
    setSeededFor(seedKey);
    setRatings(next);
    setMessage('');
  }

  const save = async () => {
    setBusy(true);
    setMessage('');
    try {
      for (const skill of SKILLS) {
        await createPreschoolAssessment({
          student_id: Number(activeStudentId),
          skill,
          rating: ratings[skill] || 'Developing',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['preschool-assessments'] });
      setMessage('Assessment saved to backend.');
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Backend unreachable — the ratings were not saved.'));
    } finally {
      setBusy(false);
    }
  };

  const student = students.find((s) => String(s.id) === activeStudentId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">{t('pages.preschool.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('pages.preschool.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Select label="Student" value={activeStudentId} onChange={(e) => setStudentId(e.target.value)} disabled={students.length === 0}>
            {students.length === 0 && <option value="">—</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name} — {s.grade_level}
              </option>
            ))}
          </Select>
          <Button onClick={save} disabled={busy || !activeStudentId}>
            {busy ? 'Saving…' : 'Save Assessment'}
          </Button>
        </div>
      </div>

      {assessmentsQuery.isError && (
        <p className="rounded-lg bg-yellow-50 dark:bg-yellow-950/40 p-3 text-sm text-yellow-800 dark:text-yellow-200">
          {apiErrorMessage(assessmentsQuery.error, 'The assessments could not be loaded.')}
        </p>
      )}
      {message && (
        <p
          className={`rounded-lg p-3 text-sm ${
            message.includes('unreachable')
              ? 'bg-yellow-50 dark:bg-yellow-950/40 dark:bg-yellow-950/40 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-200 dark:text-yellow-200 dark:text-yellow-200'
              : 'bg-green-50 dark:bg-green-950/40 dark:bg-green-950/40 dark:bg-green-950/40 text-green-800 dark:text-green-200 dark:text-green-200 dark:text-green-200'
          }`}
        >
          {message}
        </p>
      )}

      <Card title={student ? `${student.first_name} ${student.last_name}` : 'Assessment grid'} subtitle="Tap a rating for each skill">
        <div className="space-y-3">
          {SKILLS.map((skill) => (
            <div
              key={skill}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3"
            >
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{skill}</span>
              <div className="flex flex-wrap gap-1">
                {RATINGS.map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setRatings({ ...ratings, [skill]: rating })}
                    className={`rounded-lg border border-slate-200 dark:border-slate-700 dark:border-slate-700 dark:border-slate-700 px-3 py-1.5 text-xs font-bold ${
                      ratings[skill] === rating
                        ? RATING_STYLES[rating]
                        : 'bg-white dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 dark:bg-slate-900 text-slate-600 dark:text-slate-300 dark:text-slate-300 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:bg-slate-800 dark:hover:bg-slate-800'
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
