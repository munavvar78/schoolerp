'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';

export type StaffQuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'YES_NO'
  | 'THIS_OR_THAT';

export type QuestionOptionDraft = {
  id: string;
  text: string;
  isCorrect: boolean;
};

export type QuestionDraft = {
  id?: string;
  type: StaffQuestionType;
  stem: string;
  marks: number;
  sortOrder: number;
  options: QuestionOptionDraft[];
};

const TYPE_OPTIONS: Array<{ value: StaffQuestionType; label: string; hint: string }> = [
  { value: 'SINGLE_CHOICE', label: 'Single choice (MCQ)', hint: 'One correct answer · radio' },
  { value: 'MULTIPLE_CHOICE', label: 'Multiple correct', hint: 'Select all that apply · checkboxes' },
  { value: 'YES_NO', label: 'Yes / No', hint: 'Fixed Yes and No options' },
  { value: 'THIS_OR_THAT', label: 'This or that', hint: 'Exactly two custom choices' },
];

function optionId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultOptionsForType(type: StaffQuestionType): QuestionOptionDraft[] {
  if (type === 'YES_NO') {
    return [
      { id: 'yes', text: 'Yes', isCorrect: true },
      { id: 'no', text: 'No', isCorrect: false },
    ];
  }
  if (type === 'THIS_OR_THAT') {
    return [
      { id: 'this', text: 'This', isCorrect: true },
      { id: 'that', text: 'That', isCorrect: false },
    ];
  }
  if (type === 'MULTIPLE_CHOICE') {
    return [
      { id: optionId('a'), text: 'Option A', isCorrect: true },
      { id: optionId('b'), text: 'Option B', isCorrect: true },
      { id: optionId('c'), text: 'Option C', isCorrect: false },
      { id: optionId('d'), text: 'Option D', isCorrect: false },
    ];
  }
  return [
    { id: optionId('a'), text: 'Option A', isCorrect: true },
    { id: optionId('b'), text: 'Option B', isCorrect: false },
    { id: optionId('c'), text: 'Option C', isCorrect: false },
    { id: optionId('d'), text: 'Option D', isCorrect: false },
  ];
}

export function emptyQuestionDraft(sortOrder = 0): QuestionDraft {
  return {
    type: 'SINGLE_CHOICE',
    stem: '',
    marks: 1,
    sortOrder,
    options: defaultOptionsForType('SINGLE_CHOICE'),
  };
}

export function normalizeQuestionType(type: string): StaffQuestionType {
  if (type === 'MULTIPLE_CHOICE' || type === 'YES_NO' || type === 'THIS_OR_THAT') return type;
  return 'SINGLE_CHOICE';
}

export function questionTypeBadgeLabel(type: string): string {
  switch (normalizeQuestionType(type)) {
    case 'SINGLE_CHOICE':
      return 'Single';
    case 'MULTIPLE_CHOICE':
      return 'Multi';
    case 'YES_NO':
      return 'Yes/No';
    case 'THIS_OR_THAT':
      return 'This/That';
    default:
      return type;
  }
}

type Props = {
  open: boolean;
  title: string;
  initial: QuestionDraft;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (draft: QuestionDraft) => void | Promise<void>;
};

export function QuestionEditorOverlay({
  open,
  title,
  initial,
  saving,
  error,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<QuestionDraft>(initial);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(initial);
      setLocalError(null);
    }
  }, [open, initial]);

  const typeMeta = useMemo(
    () => TYPE_OPTIONS.find((t) => t.value === draft.type) ?? TYPE_OPTIONS[0]!,
    [draft.type],
  );

  const fixedOptions = draft.type === 'YES_NO' || draft.type === 'THIS_OR_THAT';
  const multi = draft.type === 'MULTIPLE_CHOICE';
  const canAddOption = !fixedOptions && draft.options.length < 8;
  const canRemoveOption = !fixedOptions && draft.options.length > 2;

  if (!open) return null;

  function setType(type: StaffQuestionType) {
    setDraft((prev) => ({
      ...prev,
      type,
      options: defaultOptionsForType(type),
    }));
  }

  function setOptionText(index: number, text: string) {
    setDraft((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, text } : o)),
    }));
  }

  function markCorrect(index: number) {
    setDraft((prev) => {
      if (prev.type === 'MULTIPLE_CHOICE') {
        return {
          ...prev,
          options: prev.options.map((o, i) =>
            i === index ? { ...o, isCorrect: !o.isCorrect } : o,
          ),
        };
      }
      return {
        ...prev,
        options: prev.options.map((o, i) => ({ ...o, isCorrect: i === index })),
      };
    });
  }

  function addOption() {
    if (!canAddOption) return;
    setDraft((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        { id: optionId('o'), text: `Option ${String.fromCharCode(65 + prev.options.length)}`, isCorrect: false },
      ],
    }));
  }

  function removeOption(index: number) {
    if (!canRemoveOption) return;
    setDraft((prev) => {
      const next = prev.options.filter((_, i) => i !== index);
      if (!next.some((o) => o.isCorrect) && next[0]) {
        next[0] = { ...next[0], isCorrect: true };
      }
      return { ...prev, options: next };
    });
  }

  function moveOption(index: number, dir: -1 | 1) {
    setDraft((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.options.length) return prev;
      const options = [...prev.options];
      const tmp = options[index]!;
      options[index] = options[target]!;
      options[target] = tmp;
      return { ...prev, options };
    });
  }

  async function handleSave() {
    setLocalError(null);
    if (!draft.stem.trim()) {
      setLocalError('Enter the question text');
      return;
    }
    if (draft.options.some((o) => !o.text.trim())) {
      setLocalError('Every option needs text');
      return;
    }
    const correct = draft.options.filter((o) => o.isCorrect).length;
    if (multi && correct < 2) {
      setLocalError('Mark at least two correct options');
      return;
    }
    if (!multi && correct !== 1) {
      setLocalError('Mark exactly one correct option');
      return;
    }
    await onSave({
      ...draft,
      stem: draft.stem.trim(),
      options: draft.options.map((o) => ({ ...o, text: o.text.trim() })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/40 backdrop-blur-[2px]" aria-busy={saving || undefined}>
      <div className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-slate-50 via-white to-teal-50/40">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 sm:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">Question authoring</p>
            <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">{title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSave()}
              loading={saving}
              loadingLabel="Saving…"
            >
              Save question
            </Button>
          </div>
        </header>

        <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 overflow-y-auto px-4 py-6 sm:px-8">
          {(localError || error) && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {localError || error}
            </div>
          )}

          <section className="space-y-4">
            <Textarea
              label="Question"
              className="min-h-[140px] text-base leading-relaxed"
              placeholder="Type the full question stem here…"
              value={draft.stem}
              onChange={(e) => setDraft((p) => ({ ...p, stem: e.target.value }))}
              disabled={saving}
              autoFocus
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Question type"
                value={draft.type}
                onChange={(e) => setType(e.target.value as StaffQuestionType)}
                disabled={saving}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Input
                label="Marks"
                type="number"
                min={0.5}
                max={100}
                step={0.5}
                value={draft.marks}
                disabled={saving}
                onChange={(e) =>
                  setDraft((p) => ({ ...p, marks: Math.max(0.5, Number(e.target.value) || 1) }))
                }
              />
            </div>
            <p className="text-sm text-slate-600">{typeMeta.hint}</p>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Answer options</h3>
                <p className="text-xs text-slate-500">
                  {multi
                    ? 'Use checkboxes to mark every correct option'
                    : 'Use the radio to mark the single correct answer'}
                </p>
              </div>
              {canAddOption ? (
                <Button type="button" size="sm" variant="outline" onClick={addOption} disabled={saving}>
                  Add option
                </Button>
              ) : null}
            </div>

            <ol className="space-y-3">
              {draft.options.map((opt, idx) => (
                <li
                  key={opt.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-3 ${
                    opt.isCorrect
                      ? 'border-teal-300 bg-teal-50/70'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <span className="mt-2 w-6 shrink-0 text-center text-sm font-semibold text-slate-500">
                    {idx + 1}.
                  </span>
                  <label className="mt-2.5 shrink-0 cursor-pointer">
                    <input
                      type={multi ? 'checkbox' : 'radio'}
                      name="correct-option"
                      checked={opt.isCorrect}
                      onChange={() => markCorrect(idx)}
                      disabled={saving}
                      className="h-4 w-4 accent-teal-700"
                      title={multi ? 'Toggle correct' : 'Mark correct'}
                    />
                  </label>
                  <Input
                    className="flex-1"
                    value={opt.text}
                    onChange={(e) => setOptionText(idx, e.target.value)}
                    disabled={saving || draft.type === 'YES_NO'}
                    placeholder={draft.type === 'THIS_OR_THAT' ? (idx === 0 ? 'This…' : 'That…') : 'Option text'}
                  />
                  {!fixedOptions ? (
                    <div className="mt-1 flex shrink-0 flex-col gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveOption(idx, -1)}
                        disabled={saving || idx === 0}
                        aria-label="Move up"
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => moveOption(idx, 1)}
                        disabled={saving || idx === draft.options.length - 1}
                        aria-label="Move down"
                      >
                        ↓
                      </Button>
                      {canRemoveOption ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removeOption(idx)}
                          disabled={saving}
                          aria-label="Remove option"
                        >
                          ✕
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
