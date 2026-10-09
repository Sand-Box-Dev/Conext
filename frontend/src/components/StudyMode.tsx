import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowUp, Check, ChevronLeft, ChevronRight, FileText, LoaderCircle, MessageCircle, MoreHorizontal, Plus, Search, Trash2, HelpCircle, Layers, PenTool } from 'lucide-react';
import { api } from '../services/api';
import { TrashConfirmDialog } from './TrashConfirmDialog';
import type { DocumentItem, EssayGrade, FlashcardItem, QuizItem, StudyCitation, StudyExam, StudyMode as StudyModeType } from '../types';

interface StudyModeProps {
  mode: StudyModeType;
  documents: DocumentItem[];
  onReviewerSelected: (documentId: number) => void;
  onGoToRecent: () => void;
  onBackToChat: () => void;
  generateForDocumentId?: number | null;
  onGenerationRequestHandled?: () => void;
}

const modeLabels: Record<StudyModeType, string> = { quiz: 'Quiz', flashcards: 'Flash-Card', essay: 'Essay' };
const modeIcons: Record<StudyModeType, React.ElementType> = {
  quiz: HelpCircle,
  flashcards: Layers,
  essay: PenTool,
};
const citationText = (citations: StudyCitation[]) => citations.map(({ page_number }) => `p. ${page_number}`).filter((page, index, pages) => pages.indexOf(page) === index).join(' · ');

export const StudyMode: React.FC<StudyModeProps> = ({ mode, documents, onReviewerSelected, onGoToRecent, onBackToChat, generateForDocumentId, onGenerationRequestHandled }) => {
  const [exams, setExams] = useState<StudyExam[]>([]);
  const [activeExam, setActiveExam] = useState<StudyExam | null>(null);
  const [isChoosingFile, setIsChoosingFile] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<StudyExam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingDocumentName, setGeneratingDocumentName] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isChecked, setIsChecked] = useState(false);
  const [activeCard, setActiveCard] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [essayText, setEssayText] = useState('');
  const [essayGrade, setEssayGrade] = useState<EssayGrade | null>(null);
  const handledGenerationRef = useRef<string | null>(null);
  const readyDocuments = useMemo(() => documents.filter((document) => document.processing_status === 'ready'), [documents]);
  const filteredDocuments = useMemo(() => documents.filter((document) => document.filename.toLowerCase().includes(reviewerSearch.trim().toLowerCase())), [documents, reviewerSearch]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    api.getStudyExams(mode)
      .then((saved) => { if (active) setExams(saved); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Could not load saved study material.'); })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [mode]);

  useEffect(() => {
    if (!activeExam) return;
    setSelectedAnswers({});
    setIsChecked(false);
    setActiveCard(0);
    setIsCardFlipped(false);
    setEssayText(activeExam.content.submission ?? '');
    setEssayGrade(activeExam.content.grade ?? null);
    setError(null);
  }, [activeExam?.id]);

  const generateForDocument = async (documentId: number) => {
    if (!documentId || isLoading) return;
    setIsLoading(true);
    setIsGenerating(true);
    setGeneratingDocumentName(documents.find((document) => document.id === documentId)?.filename ?? 'your reviewer');
    setError(null);
    try {
      const exam = mode === 'quiz'
        ? await api.generateQuiz(documentId)
        : mode === 'flashcards'
          ? await api.generateFlashcards(documentId)
          : await api.generateEssayTask(documentId);
      onReviewerSelected(documentId);
      setExams((current) => [exam, ...current]);
      setActiveExam(exam);
      setIsChoosingFile(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not generate ${modeLabels[mode].toLowerCase()}.`);
    } finally {
      setIsGenerating(false);
      setIsLoading(false);
    }
  };

  const generateExam = async (event: React.FormEvent) => {
    event.preventDefault();
    const documentId = Number(selectedDocumentId);
    if (documentId) await generateForDocument(documentId);
  };

  useEffect(() => {
    if (!generateForDocumentId || isLoading) return;
    const requestKey = `${mode}:${generateForDocumentId}`;
    if (handledGenerationRef.current === requestKey) return;
    handledGenerationRef.current = requestKey;
    onGenerationRequestHandled?.();
    void generateForDocument(generateForDocumentId);
  }, [generateForDocumentId, isLoading, mode]);

  const gradeEssay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeExam?.content.prompt || !essayText.trim() || isGrading) return;
    setIsGrading(true);
    setError(null);
    try {
      const grade = await api.gradeEssay(activeExam.document_id, activeExam.id, activeExam.content.prompt, essayText.trim());
      setEssayGrade(grade);
      const updated = { ...activeExam, content: { ...activeExam.content, submission: essayText.trim(), grade } };
      setActiveExam(updated);
      setExams((current) => current.map((exam) => exam.id === updated.id ? updated : exam));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not grade this essay.');
    } finally {
      setIsGrading(false);
    }
  };

  const startGeneration = () => {
    setSelectedDocumentId('');
    setReviewerSearch('');
    setError(null);
    setIsChoosingFile(true);
  };

  const deleteExam = async () => {
    if (!pendingDelete || isDeleting) return;
    setIsDeleting(true);
    setError(null);
    try {
      await api.deleteStudyExam(pendingDelete.id);
      setExams((current) => current.filter((exam) => exam.id !== pendingDelete.id));
      if (activeExam?.id === pendingDelete.id) setActiveExam(null);
      setPendingDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this saved study set.');
    } finally {
      setIsDeleting(false);
    }
  };

  const openExam = (exam: StudyExam) => {
    onReviewerSelected(exam.document_id);
    setActiveExam(exam);
  };

  const examsForMode = exams.filter((exam) => exam.mode === mode);
  const questions = (activeExam?.content.items ?? []) as QuizItem[];
  const flashcards = (activeExam?.content.items ?? []) as FlashcardItem[];
  const isEssayEditor = mode === 'essay' && activeExam !== null;

  return <section className={`study-page flex-1 overflow-y-auto ${isEssayEditor ? 'bg-white text-slate-950' : 'bg-[#0b0f17]'}`}>
    <div className={`mx-auto w-full px-5 py-8 sm:px-8 sm:py-10 ${isEssayEditor ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <header className={`mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-6 ${isEssayEditor ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className="flex items-center gap-3">
          {activeExam && <button type="button" className={`btn btn-ghost btn-sm btn-square ${isEssayEditor ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400'}`} onClick={() => setActiveExam(null)} aria-label="Back to saved exams"><ArrowLeft className="h-4 w-4" /></button>}
          <div>
            <p className={`text-xs ${isEssayEditor ? 'text-slate-600' : 'text-slate-500'}`}>Study library</p>
            <h1 className={`mt-0.5 flex items-center gap-2 text-2xl font-semibold ${isEssayEditor ? 'text-slate-950' : 'text-slate-100'}`}>
              {React.createElement(modeIcons[mode], { className: "h-6 w-6 text-primary shrink-0" })}
              <span>{activeExam?.title ?? modeLabels[mode]}</span>
            </h1>
            {activeExam && <p className={`mt-1 text-xs ${isEssayEditor ? 'text-slate-600' : 'text-slate-500'}`}>{activeExam.document_filename}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeExam ? <><button type="button" className={`btn btn-ghost btn-sm btn-square ${isEssayEditor ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:text-white'}`} title="Delete saved set" aria-label="Delete saved set" onClick={() => { setError(null); setPendingDelete(activeExam); }}><Trash2 className="h-4 w-4" /></button><button type="button" className={`btn btn-ghost btn-sm gap-2 ${isEssayEditor ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300'}`} onClick={onBackToChat}><MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">Conversation</span></button></> : <button type="button" className="btn btn-sm gap-2 border-white bg-white text-slate-950 hover:border-slate-200 hover:bg-slate-200" onClick={startGeneration}><Plus className="h-4 w-4" />Generate {modeLabels[mode]}</button>}
        </div>
      </header>

      {error && <div role="alert" className={`alert mb-5 border text-sm ${isEssayEditor ? 'border-slate-300 bg-white text-slate-900' : 'border-slate-700 bg-slate-900 text-slate-300'}`}><AlertCircle className="h-4 w-4" /><span>{error}</span></div>}

      {activeExam ? <>
        {mode === 'quiz' && <QuizView items={questions} citations={citationText} selectedAnswers={selectedAnswers} setSelectedAnswers={setSelectedAnswers} isChecked={isChecked} setIsChecked={setIsChecked} />}
        {mode === 'flashcards' && <FlashcardView items={flashcards} activeCard={activeCard} setActiveCard={setActiveCard} isFlipped={isCardFlipped} setIsFlipped={setIsCardFlipped} citations={citationText} />}
        {mode === 'essay' && <EssayView exam={activeExam} essayText={essayText} setEssayText={setEssayText} onSubmit={gradeEssay} isGrading={isGrading} grade={essayGrade} citations={citationText} />}
      </> : isGenerating ? <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/40 px-6 text-center" role="status" aria-live="polite">
        <LoaderCircle className="h-8 w-8 animate-spin text-slate-200" />
        <h2 className="mt-5 text-lg font-medium text-slate-100">Generating {modeLabels[mode]}…</h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">Building it from {generatingDocumentName}. This can take a little while.</p>
      </div> : isLoading ? <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-slate-400" role="status"><LoaderCircle className="h-5 w-5 animate-spin" />Loading saved {modeLabels[mode].toLowerCase()}s…</div> : examsForMode.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {examsForMode.map((exam) => <article key={exam.id} className="group relative rounded-2xl border border-slate-800 bg-slate-900/50 transition hover:border-slate-600 hover:bg-slate-900">
          <button type="button" onClick={() => openExam(exam)} className="w-full rounded-2xl p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">
            <div className="flex items-start justify-start"><span className="text-xs text-slate-500">{new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(exam.created_at))}</span></div>
            <h2 className="mt-5 line-clamp-2 text-base font-medium leading-6 text-slate-100">{exam.title}</h2>
            <p className="mt-1 truncate text-sm text-slate-400">{exam.document_filename}</p>
            <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 pr-10 text-xs text-slate-500"><span>{mode === 'quiz' ? `${exam.content.items?.length ?? 0} questions` : mode === 'flashcards' ? `${exam.content.items?.length ?? 0} cards` : exam.content.grade ? `${exam.content.grade.score}/100 graded` : 'Essay prompt'}</span><span className="text-slate-300 transition group-hover:translate-x-0.5">Open →</span></div>
          </button>
          <details className="dropdown dropdown-end absolute bottom-3 right-3 z-20"><summary aria-label={`Actions for ${exam.title}`} className="btn btn-ghost btn-xs btn-square list-none text-slate-400 hover:bg-slate-800 hover:text-white"><MoreHorizontal className="h-4 w-4" /></summary><ul className="menu dropdown-content mt-1 w-40 rounded-xl border border-slate-700 bg-slate-950 p-1 text-slate-200 shadow-xl"><li><button type="button" className="text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setError(null); setPendingDelete(exam); }}><Trash2 className="h-4 w-4" />Delete set</button></li></ul></details>
        </article>)}
      </div> : <div className="flex min-h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 px-6 py-12 text-center">
        <h2 className="text-lg font-medium text-slate-200">No saved {modeLabels[mode].toLowerCase()}zes yet</h2>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Generate one from a reviewer. It will stay here so you can come back to it later.</p>
        {!documents.length && <button type="button" className="btn btn-ghost btn-sm mt-4 text-slate-300" onClick={onGoToRecent}>Add a reviewer first</button>}
      </div>}
    </div>

    {isChoosingFile && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !isLoading) setIsChoosingFile(false); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="generate-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-300 bg-white p-6 text-slate-950 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-6"><div><p className="text-sm font-medium text-slate-600">New study set</p><h2 id="generate-title" className="mt-2 text-2xl font-semibold text-slate-950">Generate {modeLabels[mode].toLowerCase()}</h2><p className="mt-3 max-w-md text-base leading-7 text-slate-700">Choose a reviewer. We’ll use its readable passages to build a comprehensive set.</p></div><button type="button" className="btn btn-ghost btn-sm btn-square text-slate-600 hover:bg-slate-100" disabled={isLoading} onClick={() => setIsChoosingFile(false)} aria-label="Close">×</button></div>
        <form className="mt-7 space-y-6" onSubmit={generateExam}>
          <div><label htmlFor="study-reviewer-search" className="mb-3 block text-base font-medium text-slate-950">Choose a reviewer</label><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" /><input id="study-reviewer-search" className="input input-bordered h-12 w-full border-slate-300 bg-white pl-12 text-base text-slate-950 placeholder:text-slate-500 focus:border-slate-900" type="search" placeholder="Search reviewer files" value={reviewerSearch} onChange={(event) => setReviewerSearch(event.target.value)} /></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{filteredDocuments.map((document) => { const ready = document.processing_status === 'ready'; const selected = selectedDocumentId === String(document.id); return <button key={document.id} type="button" disabled={!ready} aria-pressed={selected} onClick={() => setSelectedDocumentId(String(document.id))} className={`flex min-h-16 w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-slate-950 bg-white text-slate-950 ring-1 ring-slate-950' : 'border-slate-300 bg-white text-slate-950 hover:border-slate-500 hover:bg-slate-50'}`}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${selected ? 'border-slate-300 bg-slate-100 text-slate-950' : 'border-slate-300 bg-slate-100 text-slate-700'}`}>{selected ? <Check className="h-5 w-5" /> : <FileText className="h-5 w-5" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-base font-medium text-slate-950">{document.filename}</span><span className="mt-1 block text-sm text-slate-600">{ready ? `${document.chunk_count} passages` : document.processing_status === 'processing' ? 'Preparing reviewer…' : 'Unavailable'}</span></span></button>; })}{!filteredDocuments.length && <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-base text-slate-600">No matching reviewer files.</p>}</div></div>
          {!readyDocuments.length && <div className="rounded-xl border border-slate-300 bg-slate-50 p-4 text-base text-slate-700">No ready reviewers are available. Upload a file and wait for it to finish processing.<button type="button" className="btn btn-ghost btn-sm mt-2 block text-slate-900" onClick={onGoToRecent}>Go to Recent</button></div>}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5"><button type="button" className="btn btn-ghost text-slate-700 hover:bg-slate-100" disabled={isLoading} onClick={() => setIsChoosingFile(false)}>Cancel</button><button type="submit" className="btn gap-2 border-slate-950 bg-slate-950 text-white hover:border-slate-700 hover:bg-slate-800" disabled={!selectedDocumentId || isLoading}>{isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{isLoading ? 'Generating…' : 'Generate'}</button></div>
        </form>
      </section>
    </div>}
    {pendingDelete && <TrashConfirmDialog
      filename={pendingDelete.title}
      action="delete"
      deleteLabel="Delete set"
      deleteMessage="will be removed from your study library. This can’t be undone."
      isLoading={isDeleting}
      error={error}
      onCancel={() => setPendingDelete(null)}
      onConfirm={() => { void deleteExam(); }}
    />}
  </section>;
};

const QuizView: React.FC<{ items: QuizItem[]; citations: (citations: StudyCitation[]) => string; selectedAnswers: Record<number, number>; setSelectedAnswers: React.Dispatch<React.SetStateAction<Record<number, number>>>; isChecked: boolean; setIsChecked: (value: boolean) => void }> = ({ items, citations, selectedAnswers, setSelectedAnswers, isChecked, setIsChecked }) => <div className="mx-auto max-w-3xl space-y-5">
  {isChecked && <div className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">Score: {items.reduce((total, item, index) => total + (selectedAnswers[index] === item.answer_index ? 1 : 0), 0)} / {items.length}</div>}
  {items.map((item, index) => <article key={`${index}-${item.question}`} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Question {index + 1}</p><h2 className="mt-2 text-base font-medium leading-7 text-slate-100">{item.question}</h2><div className="mt-4 space-y-2">{item.options.map((option, optionIndex) => { const chosen = selectedAnswers[index] === optionIndex; const correct = isChecked && optionIndex === item.answer_index; const wrong = isChecked && chosen && !correct; return <button key={`${optionIndex}-${option}`} type="button" aria-pressed={chosen} disabled={isChecked} onClick={() => setSelectedAnswers((current) => ({ ...current, [index]: optionIndex }))} className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${correct ? 'border-white bg-slate-700 text-white' : wrong ? 'border-slate-500 bg-slate-800 text-slate-300' : chosen ? 'border-slate-400 bg-slate-800 text-white' : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600'}`}><span className="mr-3 text-slate-500">{String.fromCharCode(65 + optionIndex)}.</span>{option}</button>; })}</div>{isChecked && <div className="mt-4 rounded-xl bg-slate-950/70 p-4 text-sm leading-6 text-slate-300"><span className="font-medium text-slate-100">Why:</span> {item.explanation}<CitationLine citations={item.citations} format={citations} /></div>}</article>)}
  {!isChecked && <button type="button" className="btn btn-neutral" disabled={Object.keys(selectedAnswers).length < items.length} onClick={() => setIsChecked(true)}><Check className="h-4 w-4" />Check answers</button>}
</div>;

const FlashcardView: React.FC<{ items: FlashcardItem[]; activeCard: number; setActiveCard: React.Dispatch<React.SetStateAction<number>>; isFlipped: boolean; setIsFlipped: React.Dispatch<React.SetStateAction<boolean>>; citations: (citations: StudyCitation[]) => string }> = ({ items, activeCard, setActiveCard, isFlipped, setIsFlipped, citations }) => items.length ? <div className="mx-auto max-w-xl"><p className="mb-3 text-center text-sm text-slate-400">Card {activeCard + 1} of {items.length}</p><button type="button" onClick={() => setIsFlipped((flipped) => !flipped)} className="flex min-h-72 w-full flex-col items-center justify-center rounded-3xl border border-slate-700 bg-slate-900 p-8 text-center shadow-lg transition hover:border-slate-500"><span className="text-xs font-medium uppercase tracking-wider text-slate-500">{isFlipped ? 'Answer' : 'Prompt'} · click to flip</span><span className="mt-5 text-xl font-medium leading-8 text-slate-100">{isFlipped ? items[activeCard].back : items[activeCard].front}</span>{isFlipped && <CitationLine citations={items[activeCard].citations} format={citations} />}</button><div className="mt-5 flex items-center justify-between"><button type="button" className="btn btn-sm btn-ghost" disabled={activeCard === 0} onClick={() => { setActiveCard((current) => current - 1); setIsFlipped(false); }}><ChevronLeft className="h-4 w-4" />Previous</button><button type="button" className="btn btn-sm btn-ghost" disabled={activeCard === items.length - 1} onClick={() => { setActiveCard((current) => current + 1); setIsFlipped(false); }}>Next<ChevronRight className="h-4 w-4" /></button></div></div> : <EmptyExam />;

const EssayView: React.FC<{ exam: StudyExam; essayText: string; setEssayText: React.Dispatch<React.SetStateAction<string>>; onSubmit: (event: React.FormEvent) => void; isGrading: boolean; grade: EssayGrade | null; citations: (citations: StudyCitation[]) => string }> = ({ exam, essayText, setEssayText, onSubmit, isGrading, grade, citations }) => <div className="mx-auto w-full max-w-7xl">
  <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
    <main className="min-w-0 space-y-5">
      <article className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-8"><p className="text-sm font-medium uppercase tracking-wide text-slate-600">Essay prompt</p><p className="mt-4 whitespace-pre-wrap text-base leading-8 text-slate-950">{exam.content.prompt}</p><CitationLine citations={exam.content.citations ?? []} format={citations} /></article>
      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-8"><label className="mb-3 block text-base font-semibold text-slate-950" htmlFor="essay-response">Your essay</label><textarea id="essay-response" className="textarea textarea-bordered min-h-80 w-full resize-y border-slate-300 bg-white text-base leading-8 text-slate-950 placeholder:text-slate-500 focus:border-slate-950" value={essayText} onChange={(event) => setEssayText(event.target.value)} maxLength={12000} placeholder="Write your response here. Support your ideas with evidence from the reviewer." /><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-slate-600">{essayText.length.toLocaleString()} / 12,000 characters</span><button className="btn gap-2 border-slate-950 bg-slate-950 text-white hover:border-slate-700 hover:bg-slate-800" type="submit" disabled={!essayText.trim() || isGrading}>{isGrading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}{isGrading ? 'Grading…' : grade ? 'Grade again' : 'Grade essay'}</button></div></form>
    </main>
    <aside className="min-w-0">
      <section className="rounded-2xl border border-slate-300 bg-white p-6 sm:p-7"><div className="flex items-center justify-between gap-3"><div><p className="text-sm text-slate-600">Scoring guide</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Essay criteria</h2></div><span className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-950">100 points</span></div><div className="mt-5 divide-y divide-slate-200">{(exam.content.rubric ?? []).map((criterion) => <div key={criterion.criterion} className="py-4 first:pt-0 last:pb-0"><div className="flex justify-between gap-4 text-sm"><span className="font-semibold text-slate-950">{criterion.criterion}</span><span className="shrink-0 text-slate-700">{criterion.points} pts</span></div><p className="mt-2 text-sm leading-6 text-slate-700">{criterion.description}</p></div>)}</div></section>
    </aside>
  </div>
  {grade && <section className="mt-6 w-full rounded-2xl border border-slate-300 bg-white p-6 sm:p-8" aria-live="polite"><div className="flex flex-wrap items-start justify-between gap-6 border-b border-slate-200 pb-6"><div><p className="text-sm uppercase tracking-wide text-slate-600">Your grade</p><h2 className="mt-1 text-4xl font-semibold text-slate-950">{grade.score}<span className="text-xl font-normal text-slate-600"> / 100</span></h2></div><p className="max-w-3xl flex-1 text-base leading-7 text-slate-800">{grade.overall_feedback}</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{grade.criteria.map((criterion) => <article key={criterion.criterion} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold text-slate-950">{criterion.criterion}</h3><span className="shrink-0 text-sm font-medium text-slate-800">{criterion.score}/{criterion.points}</span></div><p className="mt-3 text-sm leading-6 text-slate-700">{criterion.feedback}</p></article>)}</div><div className="mt-6 grid gap-6 border-t border-slate-200 pt-6 sm:grid-cols-2"><FeedbackList title="Strengths" items={grade.strengths} /><FeedbackList title="Recommendations" items={grade.recommendations ?? grade.next_steps} /></div><CitationLine citations={grade.citations} format={citations} /></section>}
</div>;

const FeedbackList: React.FC<{ title: string; items: string[] }> = ({ title, items }) => <div><h3 className="text-base font-semibold text-slate-950">{title}</h3>{items.length ? <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-800">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ol> : <p className="mt-3 text-sm text-slate-700">No recommendations available.</p>}</div>;
const CitationLine: React.FC<{ citations: StudyCitation[]; format: (citations: StudyCitation[]) => string }> = ({ citations, format }) => citations.length ? <p className="mt-3 text-xs text-slate-500">Sources: {format(citations)}</p> : null;
const EmptyExam: React.FC = () => <div className="rounded-2xl border border-slate-800 p-8 text-center text-sm text-slate-500">No items were saved in this set.</div>;
