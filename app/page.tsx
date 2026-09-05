"use client";

import { useEffect, useState } from "react";
import { readUploadResponse } from "@/lib/upload-response";
import { AlertTriangle, Box, Check, ChevronDown, ChevronUp, Clock3, Loader2, Lock, LogOut, Pencil, Play, Plus, Printer, Trash2 } from "lucide-react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Status = "waiting" | "printing" | "completed" | "error";
type Priority = "urgent" | "normal" | "low";
type Job = { screenshot?: string; id: number; printer: string; modelName: string; fileName: string; quantity: number; completedQuantity: number; material: string; color: string; nozzle: string; estimatedTime: string; printSettings: string; customer: string; operator: string; note: string; status: Status; priority: Priority; sortOrder: number };
const printers = ["P2S", "H2S", "A2L", "A1", "X2D"];
const operators = ["김명규", "김점석", "최양순"];
const blank: Omit<Job, "id"> = { printer: "P2S", modelName: "", fileName: "", quantity: 1, completedQuantity: 0, material: "PLA", color: "White", nozzle: "0.4 mm", estimatedTime: "", printSettings: "0.20 mm Standard", customer: "", operator: "", note: "", status: "waiting", priority: "normal", sortOrder: 99 };
const statusInfo: Record<Status, { label: string; cls: string; icon: typeof Clock3 }> = {
  waiting: { label: "출력 대기", cls: "bg-amber-100 text-amber-800", icon: Clock3 },
  printing: { label: "출력 중", cls: "bg-blue-100 text-blue-700", icon: Play },
  completed: { label: "완료", cls: "bg-emerald-100 text-emerald-700", icon: Check },
  error: { label: "오류", cls: "bg-red-100 text-red-700", icon: AlertTriangle },
};
const priorityRank: Record<Priority, number> = { urgent: 0, normal: 1, low: 2 };

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState("");
  const [authError, setAuthError] = useState(false);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Job | null>(null);
  const [editing, setEditing] = useState<Job | null>(null);
  const [saving, setSaving] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerPrinter, setRegisterPrinter] = useState("P2S");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [collapsedCompleted, setCollapsedCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const saved = localStorage.getItem("printfarm_auth");
    if (saved === "1938") {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    let active = true;
    setLoading(true);
    fetch("/api/jobs")
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) setJobs(d.jobs);
      })
      .catch(e => toast.error(e instanceof Error ? e.message : "불러오기 실패"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [isAuthenticated]);

  function handleLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (passcode.trim() === "1938") {
      localStorage.setItem("printfarm_auth", "1938");
      setIsAuthenticated(true);
      setAuthError(false);
      setPasscode("");
      toast.success("로그인되었습니다.");
    } else {
      setAuthError(true);
      toast.error("비밀번호가 올바르지 않습니다.");
    }
  }

  function handleLogout() {
    localStorage.removeItem("printfarm_auth");
    setIsAuthenticated(false);
    setPasscode("");
    toast.info("로그아웃되었습니다.");
  }

  const statusRank: Record<Status, number> = { printing: 0, error: 1, waiting: 2, completed: 3 };
  const sortedJobs = [...jobs].sort((a, b) => {
    const sDiff = statusRank[a.status] - statusRank[b.status];
    if (sDiff !== 0) return sDiff;
    if (a.status === "completed") return b.id - a.id;
    return priorityRank[a.priority] - priorityRank[b.priority] || a.sortOrder - b.sortOrder || a.id - b.id;
  });

  const toggleCompleted = (printer: string) => {
    setCollapsedCompleted(prev => ({ ...prev, [printer]: !prev[printer] }));
  };

  async function patchJob(id: number, changes: Partial<Job>, quiet = false) { const previous = jobs; setJobs(v => v.map(j => j.id === id ? { ...j, ...changes } : j)); try { const r = await fetch(`/api/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setJobs(v => v.map(j => j.id === id ? d.job : j)); setSelected(v => v?.id === id ? d.job : v); if (!quiet) toast.success("작업이 업데이트되었습니다."); } catch (e) { setJobs(previous); toast.error(e instanceof Error ? e.message : "수정 실패"); } }
  async function removeJob(id: number) { if (!confirm("이 작업을 삭제할까요?")) return; const r = await fetch(`/api/jobs/${id}`, { method: "DELETE" }); if (r.ok) { setJobs(v => v.filter(j => j.id !== id)); setSelected(null); toast.success("작업을 삭제했습니다."); } else toast.error("삭제하지 못했습니다."); }
  async function saveJob(data: Omit<Job, "id"> | Job) { setSaving(true); try { const hasId = "id" in data; const r = await fetch(hasId ? `/api/jobs/${data.id}` : "/api/jobs", { method: hasId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setJobs(v => hasId ? v.map(j => j.id === d.job.id ? d.job : j) : [...v, d.job]); setEditing(null); setSelected(null); toast.success(hasId ? "작업을 수정했습니다." : "새 작업을 추가했습니다."); } catch (e) { toast.error(e instanceof Error ? e.message : "저장 실패"); } finally { setSaving(false); } }
  async function moveByDrag(targetPrinter: string, targetId?: number) { if (draggingId === null) return; const dragged = jobs.find(job => job.id === draggingId); if (!dragged) return; const column = sortedJobs.filter(job => job.printer === targetPrinter && job.id !== dragged.id); const targetIndex = targetId === undefined ? column.length : Math.max(0, column.findIndex(job => job.id === targetId)); const reordered = [...column]; reordered.splice(targetIndex, 0, { ...dragged, printer: targetPrinter }); const updates = reordered.map((job, sortOrder) => ({ id: job.id, changes: { ...(job.id === dragged.id ? { printer: targetPrinter } : {}), sortOrder } })); const previous = jobs; setDraggingId(null); setJobs(current => current.map(job => { const update = updates.find(item => item.id === job.id); return update ? { ...job, ...update.changes } : job; })); try { const responses = await Promise.all(updates.map(async update => { const response = await fetch(`/api/jobs/${update.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update.changes) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data.job as Job; })); setJobs(current => current.map(job => responses.find(updated => updated.id === job.id) ?? job)); } catch (error) { setJobs(previous); toast.error(error instanceof Error ? error.message : "작업 순서를 저장하지 못했습니다."); } }
  async function move(job: Job, direction: -1 | 1) {
    const isCompleted = job.status === "completed";
    const isPrinting = job.status === "printing";
    const group = sortedJobs.filter(item =>
      item.printer === job.printer && (
        isCompleted ? item.status === "completed" :
        isPrinting ? item.status === "printing" :
        (item.status === "waiting" || item.status === "error")
      )
    );
    const index = group.findIndex(item => item.id === job.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= group.length) return;
    const target = group[targetIndex];
    const reordered = [...group];
    reordered[index] = target;
    reordered[targetIndex] = job;
    const updates = reordered.map((item, idx) => ({ id: item.id, sortOrder: idx }));
    setJobs(current => current.map(j => {
      const u = updates.find(x => x.id === j.id);
      return u ? { ...j, sortOrder: u.sortOrder } : j;
    }));
    try {
      await Promise.all(updates.map(u => patchJob(u.id, { sortOrder: u.sortOrder }, true)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "작업 순서를 저장하지 못했습니다.");
    }
  }
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#f4f5f7] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#f4f5f7] flex items-center justify-center p-4">
        <Toaster position="bottom-right" richColors />
        <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-7 sm:p-9 shadow-xl text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-slate-900 text-white shadow-lg">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            김명규크리에이티브
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-medium">
            프린트팜 보드 접속 비밀번호를 입력해주세요
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={10}
                placeholder="비밀번호 4자리"
                value={passcode}
                onChange={e => {
                  setPasscode(e.target.value);
                  setAuthError(false);
                }}
                autoFocus
                className={`h-12 text-center text-2xl tracking-[0.3em] font-black rounded-xl bg-slate-50 border-slate-200 ${
                  authError ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/30" : ""
                }`}
              />
              {authError && (
                <p className="mt-2 text-xs font-bold text-red-600 flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> 비밀번호가 올바르지 않습니다.
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-base font-bold shadow-md transition-all active:scale-98"
            >
              로그인
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-semibold text-slate-400">
            3D Print Farm Management System
          </div>
        </div>
      </main>
    );
  }

  const counts = { total: jobs.length, printing: jobs.filter(j => j.status === "printing").length, waiting: jobs.filter(j => j.status === "waiting").length, completed: jobs.filter(j => j.status === "completed").length };

  return <main className="min-h-screen bg-[#f4f5f7] text-[#15191f]">
    <Toaster position="bottom-right" richColors />
    <header className="border-b border-slate-200 bg-white px-3 py-4 sm:px-4 sm:py-5 lg:px-7"><div className="mx-auto flex max-w-[1800px] flex-col gap-3 sm:gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="flex items-center gap-3 sm:gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-sm sm:h-12 sm:w-12"><Printer className="h-5 w-5 sm:h-6 sm:w-6" /></div><h1 className="text-2xl font-black tracking-[-.04em] sm:text-3xl">김명규크리에이티브 작업관리 시스템</h1></div>
      <div className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-2">
        <Stat label="전체 작업" value={counts.total} />
        <Stat label="출력 중" value={counts.printing} tone="blue" />
        <Stat label="대기" value={counts.waiting} tone="amber" />
        <Stat label="완료" value={counts.completed} tone="green" />
        <Button className="col-span-3 h-10 rounded-lg bg-blue-600 px-4 text-sm font-bold hover:bg-blue-700 sm:ml-1 sm:h-12 sm:rounded-xl sm:px-5 sm:text-base" onClick={() => { setRegisterPrinter("P2S"); setRegisterOpen(true); }}><Plus className="mr-1.5 h-4 w-4 sm:mr-2 sm:h-5 sm:w-5" /> 작업 등록</Button>
        <Button variant="outline" onClick={handleLogout} className="col-span-1 h-10 rounded-lg sm:h-12 sm:rounded-xl border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5" title="로그아웃"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">로그아웃</span></Button>
      </div>
    </div></header>
    <section className="mx-auto max-w-[1800px] p-2 sm:p-3 lg:p-6">{loading ? <div className="flex h-[60vh] items-center justify-center text-slate-500"><Loader2 className="mr-2 animate-spin" /> 작업 불러오는 중</div> : <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
      {printers.map(printer => {
        const printerJobs = sortedJobs.filter(j => j.printer === printer);
        const printingJobs = printerJobs.filter(j => j.status === "printing");
        const waitingJobs = printerJobs.filter(j => j.status === "waiting" || j.status === "error");
        const completedJobs = printerJobs.filter(j => j.status === "completed");
        const activeCount = printingJobs.length + waitingJobs.length;
        const isPrinting = printingJobs.length > 0;
        const hasError = printerJobs.some(j => j.status === "error");
        const isCollapsed = Boolean(collapsedCompleted[printer]);

        return <section key={printer} onDragOver={event=>event.preventDefault()} onDrop={()=>void moveByDrag(printer)} className="flex flex-col min-h-[320px] rounded-xl border border-slate-200 bg-[#e9ebef] p-1.5 shadow-[0_1px_2px_rgba(0,0,0,.03)] sm:min-h-[540px] sm:rounded-2xl sm:p-2.5">
          <div className="mb-2 flex items-center justify-between gap-1 px-0.5 py-0.5 sm:mb-3 sm:px-1 sm:py-1">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
              <div className="hidden h-9 w-9 place-items-center rounded-xl bg-slate-900 text-white sm:grid"><Printer className="h-4 w-4" /></div>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-black sm:text-lg">{printer}</h2>
                <p className="text-[10px] font-semibold text-slate-500 sm:text-xs">대기/출력 {activeCount}건 · 완료 {completedJobs.length}건</p>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold sm:px-2.5 sm:py-1 sm:text-xs ${hasError ? "bg-red-100 text-red-700" : isPrinting ? "bg-blue-100 text-blue-700 font-extrabold" : waitingJobs.length ? "bg-amber-100 text-amber-800" : completedJobs.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
              {hasError ? "오류" : isPrinting ? "출력 중" : waitingJobs.length ? "대기" : completedJobs.length ? "완료" : "비어 있음"}
            </span>
          </div>

          <div className="flex flex-col flex-1 space-y-2">
            {/* 1. 출력 중인 작업 (맨 위) */}
            {printingJobs.length > 0 && (
              <div className="space-y-1.5 sm:space-y-2">
                <div className="flex items-center justify-between px-1 text-[11px] font-black text-blue-700 sm:text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
                    </span>
                    출력 중
                  </span>
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-200">
                    {printingJobs.length}개
                  </span>
                </div>
                {printingJobs.map((job, index) => (
                  <div key={job.id} draggable onDragStart={event=>{ event.dataTransfer.effectAllowed="move"; setDraggingId(job.id); }} onDragEnd={()=>setDraggingId(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{ event.stopPropagation(); void moveByDrag(printer,job.id); }} className={draggingId===job.id?"opacity-40":""}>
                    <JobCard job={job} first={index===0} last={index===printingJobs.length-1} onOpen={() => setSelected(job)} onStatus={(status) => void patchJob(job.id,{status})} onOperatorChange={(operator) => void patchJob(job.id,{operator})} onMove={(direction) => void move(job,direction)} />
                  </div>
                ))}
              </div>
            )}

            {/* 2. 대기 중인 작업 (출력 중 아래) */}
            {waitingJobs.length > 0 && (
              <div className="space-y-1.5 sm:space-y-2">
                {printingJobs.length > 0 && (
                  <div className="flex items-center justify-between px-1 pt-1 text-[11px] font-bold text-slate-600 sm:text-xs">
                    <span className="flex items-center gap-1 text-slate-700 font-extrabold">
                      <Clock3 className="h-3 w-3 text-amber-600" />
                      출력 대기
                    </span>
                    <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                      {waitingJobs.length}개
                    </span>
                  </div>
                )}
                {waitingJobs.map((job, index) => (
                  <div key={job.id} draggable onDragStart={event=>{ event.dataTransfer.effectAllowed="move"; setDraggingId(job.id); }} onDragEnd={()=>setDraggingId(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{ event.stopPropagation(); void moveByDrag(printer,job.id); }} className={draggingId===job.id?"opacity-40":""}>
                    <JobCard job={job} first={index===0} last={index===waitingJobs.length-1} onOpen={() => setSelected(job)} onStatus={(status) => void patchJob(job.id,{status})} onOperatorChange={(operator) => void patchJob(job.id,{operator})} onMove={(direction) => void move(job,direction)} />
                  </div>
                ))}
              </div>
            )}

            {/* 대기/출력 작업이 없을 때 등록 버튼 */}
            {activeCount === 0 && (
              <button onClick={() => { setRegisterPrinter(printer); setRegisterOpen(true); }} className="flex h-24 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-[11px] font-semibold text-slate-400 transition hover:border-blue-400 hover:text-blue-600 sm:h-36 sm:rounded-xl sm:text-sm">
                <Plus className="mb-1 h-4 w-4 sm:mb-2 sm:h-6 sm:w-6" />
                작업 등록
              </button>
            )}

            {/* 3. 하단: 따로 섹션 나눈 완료된 작업 (맨 밑) */}
            {completedJobs.length > 0 && (
              <div className="mt-auto pt-2">
                <div className="rounded-xl border border-slate-300/80 bg-slate-200/60 p-2 sm:p-2.5">
                  <div className="flex items-center justify-between px-0.5 pb-1.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>완료된 작업</span>
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[10px] font-black text-emerald-800">
                        {completedJobs.length}
                      </span>
                    </div>
                    <button type="button" onClick={() => toggleCompleted(printer)} className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-800 transition">
                      <span>{isCollapsed ? "펼치기" : "접기"}</span>
                      {isCollapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-1.5 sm:space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
                      {completedJobs.map((job, index) => (
                        <div key={job.id} draggable onDragStart={event=>{ event.dataTransfer.effectAllowed="move"; setDraggingId(job.id); }} onDragEnd={()=>setDraggingId(null)} onDragOver={event=>event.preventDefault()} onDrop={event=>{ event.stopPropagation(); void moveByDrag(printer,job.id); }} className={draggingId===job.id?"opacity-40":""}>
                          <JobCard job={job} first={index===0} last={index===completedJobs.length-1} onOpen={() => setSelected(job)} onStatus={(status) => void patchJob(job.id,{status})} onOperatorChange={(operator) => void patchJob(job.id,{operator})} onMove={(direction) => void move(job,direction)} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      })}</div>}</section>
    <Dialog open={registerOpen} onOpenChange={setRegisterOpen}><DialogContent className="max-h-[92vh] overflow-y-auto"><DialogHeader><DialogTitle>작업 등록</DialogTitle><DialogDescription>스크린샷은 선택 사항입니다. 파일 선택이나 붙여넣기로 추가할 수 있습니다.</DialogDescription></DialogHeader><ScreenshotForm key={registerOpen ? registerPrinter : "closed"} initialPrinter={registerPrinter} onSaved={(job) => { setJobs(v => [...v, job]); setRegisterOpen(false); }} /></DialogContent></Dialog>
    <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
      <DialogContent className="max-h-[92vh] sm:max-w-4xl p-0 gap-0 flex flex-col overflow-hidden [&>button]:z-30 [&>button]:text-slate-600 [&>button:hover]:text-slate-900 [&>button]:bg-slate-100/90 [&>button:hover]:bg-slate-200 [&>button]:rounded-full [&>button]:p-1.5">
        <div className="overflow-y-auto flex-1 overscroll-contain">
          {selected && <Detail job={selected} onEdit={() => { setEditing(selected); setSelected(null); }} onDelete={() => void removeJob(selected.id)} onPatch={(c) => void patchJob(selected.id,c)} />}
        </div>
      </DialogContent>
    </Dialog>
    <Dialog open={!!editing} onOpenChange={(v) => { if (!v) setEditing(null); }}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl">작업 수정</DialogTitle><DialogDescription>모델과 출력 조건을 수정합니다.</DialogDescription></DialogHeader>{editing && <JobForm initial={editing} saving={saving} onSave={saveJob} onCancel={() => setEditing(null)} />}</DialogContent></Dialog>
  </main>;
}

function Stat({label,value,tone="slate"}:{label:string;value:number;tone?:string}) { const colors:Record<string,string>={slate:"bg-slate-100 text-slate-900",blue:"bg-blue-50 text-blue-700",amber:"bg-amber-50 text-amber-800",green:"bg-emerald-50 text-emerald-700"}; return <div className={`min-w-0 rounded-lg px-2 py-1.5 sm:min-w-[82px] sm:rounded-xl sm:px-3 sm:py-2 ${colors[tone]}`}><div className="truncate text-[10px] font-semibold opacity-65 sm:text-xs">{label}</div><div className="text-lg font-black leading-5 sm:text-xl sm:leading-6">{value}</div></div> }

function cleanFileNameToBase(name: string): string {
  if (!name) return "";
  return name.replace(/\.(gcode(\.3mf)?|3mf|stl|png|jpe?g|webp)$/i, "").trim() || name;
}

function JobCard({job,first,last,onOpen,onStatus,onOperatorChange,onMove}:{job:Job;first:boolean;last:boolean;onOpen:()=>void;onStatus:(s:Status)=>void;onOperatorChange:(operator:string)=>void;onMove:(d:-1|1)=>void}) {
  const isCompleted = job.status === "completed";
  const isPrinting = job.status === "printing";

  if (job.screenshot) {
    return (
      <article onClick={onOpen} className={`group cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-xl ${
        isCompleted ? "border-emerald-200 bg-emerald-50/20" :
        isPrinting ? "border-blue-300 ring-1 ring-blue-200" :
        job.priority === "urgent" ? "border-l-[3px] border-l-red-500 sm:border-l-4" : "border-slate-200"
      }`}>
        <div className="relative">
          <div className="block w-full overflow-hidden bg-slate-950/90 relative group/thumb">
            <img src={job.screenshot} alt={job.modelName} className="w-full h-auto block object-contain transition-transform duration-200 group-hover/thumb:scale-101" loading="lazy" />
            <button
              type="button"
              onClick={onOpen}
              className="absolute top-2 right-2 rounded-md bg-black/75 hover:bg-black text-white px-2.5 py-1 text-[11px] font-bold backdrop-blur-xs shadow-md flex items-center gap-1 transition-all border border-white/25 hover:border-white/40 z-10"
            >
              상세보기 ↗
            </button>
          </div>
          <div className="p-2 sm:p-2.5 bg-white/95 border-b border-slate-100">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap">
                  {job.priority === "urgent" && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600">긴급</span>}
                  {isCompleted && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700">완료</span>}
                  <h4 className="truncate text-sm sm:text-base font-black text-slate-900 leading-tight" title={job.modelName}>{job.modelName}</h4>
                </div>
                <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs mt-0.5">{job.customer ? `고객: ${job.customer}` : "고객 미지정"}</p>
              </div>

              <div className="flex shrink-0 gap-0.5 ml-1 pt-0.5" onClick={event => event.stopPropagation()}>
                <button type="button" aria-label="작업 위로 이동" disabled={first} onClick={() => onMove(-1)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
                <button type="button" aria-label="작업 아래로 이동" disabled={last} onClick={() => onMove(1)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              </div>
            </div>

            {job.fileName && (
              <div className="mt-2 rounded-lg bg-slate-100/90 p-2 border border-slate-200">
                <div className="flex items-start gap-1.5">
                  <span className="shrink-0 rounded bg-blue-600 px-1 py-0.5 text-[8px] font-black tracking-tight text-white leading-none mt-0.5">
                    GCODE
                  </span>
                  <span className="font-mono text-xs sm:text-[13px] font-extrabold text-slate-800 break-all leading-snug" title={`프린터 파일: ${job.fileName}`}>
                    {job.fileName}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-1.5 p-2 sm:p-2.5">
          <div className="grid grid-cols-3 gap-1 text-[10px] sm:text-xs">
            <Meta label="수량" value={`${job.completedQuantity}/${job.quantity}개`} />
            <Meta label="재료" value={job.material} />
            <Meta label="색상" value={job.color} />
          </div>
          <StatusActions current={job.status} operator={job.operator} onStatus={onStatus} onOperatorChange={onOperatorChange} />
        </div>
        {isPrinting && (
          <div className="h-1 bg-blue-100">
            <div className="h-full bg-blue-500 animate-pulse" style={{ width: `${Math.max(8, (job.completedQuantity / job.quantity) * 100)}%` }} />
          </div>
        )}
      </article>
    );
  }

  return (
    <article onClick={onOpen} className={`group cursor-pointer overflow-hidden rounded-lg border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-xl ${
      isCompleted ? "border-emerald-200 bg-emerald-50/20" :
      isPrinting ? "border-blue-300 ring-1 ring-blue-200" :
      job.priority === "urgent" ? "border-l-[3px] border-l-red-500 sm:border-l-4" : "border-slate-200"
    }`}>
      <div className="p-2 sm:p-3">
        <div className="flex items-start gap-2 sm:gap-3">
          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md sm:h-11 sm:w-11 sm:rounded-lg ${
            isCompleted ? "bg-emerald-100 text-emerald-700" :
            isPrinting ? "bg-blue-100 text-blue-700" :
            job.material.includes("CF") ? "bg-zinc-800 text-zinc-100" :
            job.color.toLowerCase().includes("white") ? "border bg-slate-50 text-slate-500" :
            "bg-gradient-to-br from-blue-100 to-indigo-200 text-blue-700"
          }`}>
            {isCompleted ? <Check className="h-5 w-5 sm:h-6 sm:w-6" /> : <Box className="h-5 w-5 sm:h-6 sm:w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-1 sm:gap-1.5">
              {job.priority === "urgent" && <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-black text-red-600 sm:text-[11px]">긴급</span>}
              {job.priority === "low" && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:text-[11px]">낮음</span>}
              {isCompleted && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-black text-emerald-700 sm:text-[11px]">완료됨</span>}
            </div>

            <h3 className="truncate text-sm sm:text-base font-black text-slate-900 leading-tight" title={job.modelName}>
              {job.modelName}
            </h3>
            <p className="truncate text-[11px] font-medium text-slate-500 sm:text-xs mt-0.5">
              {job.customer ? `고객: ${job.customer}` : "고객 미지정"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              onClick={onOpen}
              className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 shadow-2xs transition-colors"
            >
              상세보기
            </button>
            <button type="button" aria-label="작업 위로 이동" disabled={first} onClick={() => onMove(-1)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
            <button type="button" aria-label="작업 아래로 이동" disabled={last} onClick={() => onMove(1)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
          </div>
        </div>

        {job.fileName ? (
          <div className="mt-2.5 rounded-lg bg-slate-100/90 p-2 sm:p-2.5 border border-slate-200">
            <div className="flex items-start gap-1.5">
              <span className="shrink-0 rounded bg-blue-600 px-1 py-0.5 text-[8px] font-black tracking-tight text-white leading-none mt-0.5">
                GCODE
              </span>
              <span className="font-mono text-xs sm:text-[13px] font-extrabold text-slate-800 break-all leading-snug" title={`프린터 파일: ${job.fileName}`}>
                {job.fileName}
              </span>
            </div>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-x-1 gap-y-1 border-t border-slate-100 pt-1.5 text-[10px] sm:gap-x-2 sm:gap-y-2 sm:pt-2.5 sm:text-xs">
          <Meta label="재료" value={`${job.material} · ${job.color}`} />
          <Meta label="수량" value={`${job.completedQuantity}/${job.quantity}개`} />
          <Meta label="시간" value={job.estimatedTime || "미입력"} />
        </div>
        <StatusActions current={job.status} operator={job.operator} onStatus={onStatus} onOperatorChange={onOperatorChange} />
        {job.note && <p className="mt-1.5 truncate rounded-md bg-slate-50 px-1.5 py-1 text-[10px] font-medium text-slate-600 sm:mt-2 sm:px-2 sm:py-1.5 sm:text-xs">{job.note}</p>}
      </div>
      {isPrinting && (
        <div className="h-1 bg-blue-100">
          <div className="h-full bg-blue-500 animate-pulse" style={{ width: `${Math.max(8, (job.completedQuantity / job.quantity) * 100)}%` }} />
        </div>
      )}
    </article>
  );
}
function StatusActions({current,operator,onStatus,onOperatorChange}:{current:Status;operator:string;onStatus:(status:Status)=>void;onOperatorChange:(operator:string)=>void}) { return <div className="mt-2 space-y-2 border-t border-slate-100 pt-2 sm:mt-3 sm:pt-2.5" onClick={event=>event.stopPropagation()}><div className="grid grid-cols-3 gap-1 sm:gap-1.5">{(["waiting","printing","completed"] as Status[]).map(status => { const Icon=statusInfo[status].icon; const active=current===status; const label=status==="waiting"?"대기":status==="printing"?"출력":"완료"; return <button key={status} type="button" onClick={()=>onStatus(status)} aria-label={`${label} 상태로 변경`} aria-pressed={active} className={`flex min-h-8 items-center justify-center gap-1 rounded-md px-1 py-1 text-[10px] font-bold transition sm:min-h-9 sm:rounded-lg sm:px-2 sm:text-xs ${active?statusInfo[status].cls:"bg-slate-100 text-slate-500 hover:bg-slate-200"}`}><Icon className="h-3 w-3" /><span>{label}</span></button>; })}</div>{current!=="waiting"&&<div className="flex items-center gap-2"><span className="shrink-0 text-[10px] font-bold text-slate-500 sm:text-xs">작업자</span><Select value={operator || "unassigned"} onValueChange={value=>onOperatorChange(value==="unassigned"?"":value)}><SelectTrigger aria-label="작업자 선택" className="h-8 flex-1 text-xs sm:h-9"><SelectValue placeholder="작업자를 선택하세요" /></SelectTrigger><SelectContent><SelectItem value="unassigned">작업자 선택</SelectItem>{operators.map(name=><SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>}</div> }
function Meta({label,value}:{label:string;value:string}) { return <div className="min-w-0"><span className="text-[9px] text-slate-400 sm:text-xs">{label}</span><div className="truncate font-bold text-slate-700">{value}</div></div> }

function Detail({job,onEdit,onDelete,onPatch}:{job:Job;onEdit:()=>void;onDelete:()=>void;onPatch:(c:Partial<Job>)=>void}) {
  const info = statusInfo[job.status];
  return (
    <div className="p-4 sm:p-6 bg-slate-100/70 min-h-full">
      <DialogHeader className="sr-only">
        <DialogTitle>{job.modelName}</DialogTitle>
        <DialogDescription>프린터 작업 상세 정보 및 출력 제어</DialogDescription>
      </DialogHeader>

      {/* 4사분면 레이아웃 */}
      <div className="space-y-4 sm:space-y-5">
        {/* 상단 행: 제2사분면(좌상단, 사진) & 제1사분면(우상단, 모델명·상태·수량) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          
          {/* [제2사분면 - 좌상단]: 사진 / 미리보기 */}
          <section aria-label="모델 사진" className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <span className="text-xs font-black text-slate-600 flex items-center gap-1.5">
                📷 모델 사진 / 미리보기
              </span>
              {job.screenshot && (
                <a
                  href={job.screenshot}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 px-2 py-0.5 text-[11px] font-bold flex items-center gap-1 transition-colors"
                >
                  원본 크게 보기 ↗
                </a>
              )}
            </div>
            <div className="relative flex-1 min-h-[220px] sm:min-h-[260px] rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center p-2 border border-slate-900">
              {job.screenshot ? (
                <img
                  src={job.screenshot}
                  alt={job.modelName}
                  className="max-h-[260px] w-full h-auto object-contain rounded"
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                  <Box className="h-12 w-12 text-slate-600 mb-2" />
                  <span className="text-xs font-bold">등록된 스크린샷이 없습니다</span>
                </div>
              )}
            </div>
          </section>

          {/* [제1사분면 - 우상단]: 모델 기본 정보 & 진행상태 & 완료 수량 & 수정/삭제 */}
          <section aria-label="작업 정보 및 제어" className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs justify-between">
            <div>
              {/* 상단 바: 프린터 뱃지 & 수정/삭제 버튼 (닫기 X 버튼과 겹치지 않게 mr-8 적용) */}
              <div className="flex items-center justify-between gap-2 mr-8">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  <Printer className="h-3.5 w-3.5" />{job.printer} · {info.label}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={onEdit} className="h-7 sm:h-8 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold px-2.5">
                    <Pencil className="h-3.5 w-3.5" /> 수정
                  </Button>
                  <Button size="sm" variant="outline" onClick={onDelete} className="h-7 sm:h-8 border-slate-200 text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-bold px-2.5">
                    <Trash2 className="h-3.5 w-3.5" /> 삭제
                  </Button>
                </div>
              </div>

              {/* 모델명 */}
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-2.5 leading-snug">
                {job.modelName}
              </h2>

              {/* GCODE 파일명 박스 */}
              <div className="mt-2.5 rounded-lg bg-slate-100 p-2 sm:p-2.5 border border-slate-200/90">
                <div className="flex items-start gap-1.5">
                  <span className="shrink-0 rounded bg-blue-600 px-1.5 py-0.5 text-[8px] font-black tracking-tight text-white leading-none mt-0.5">
                    GCODE
                  </span>
                  <span className="font-mono text-xs sm:text-[13px] font-extrabold text-slate-800 break-all leading-snug">
                    {job.fileName || "파일명 미입력"}
                  </span>
                </div>
              </div>
            </div>

            {/* 진행 상태 변경 & 완료 수량 */}
            <div className="mt-4 space-y-3 pt-3 border-t border-slate-100">
              <div>
                <div className="mb-1.5 text-xs font-black text-slate-500">진행 상태 변경</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["waiting","printing","completed"] as Status[]).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onPatch({ status: s })}
                      className={`rounded-lg border py-2 text-xs font-bold transition ${
                        job.status === s
                          ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs font-black"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      {statusInfo[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-black text-slate-500">완료 수량</span>
                  <b className="text-sm font-extrabold text-slate-900">{job.completedQuantity} / {job.quantity}개</b>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => onPatch({ completedQuantity: Math.max(0, job.completedQuantity - 1) })} className="h-8 w-8 font-bold text-base">−</Button>
                  <div className="flex-1 overflow-hidden rounded-lg bg-slate-100 h-3.5 p-0.5">
                    <div className="h-full rounded-md bg-emerald-500 transition-all" style={{ width: `${job.quantity ? (job.completedQuantity / job.quantity) * 100 : 0}%` }} />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => onPatch({ completedQuantity: Math.min(job.quantity, job.completedQuantity + 1) })} className="h-8 w-8 font-bold text-base">+</Button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 하단 행: 제3사분면(좌하단, 출력상세조건) & 제4사분면(우하단, 주문·메모) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          
          {/* [제3사분면 - 좌하단]: 출력 상세 조건 스펙 */}
          <section aria-label="출력 조건" className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs">
            <h3 className="text-xs font-black text-slate-600 mb-3 flex items-center gap-1.5">
              ⚙️ 출력 상세 조건
            </h3>
            <div className="grid grid-cols-2 gap-3.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
              <Info label="필라멘트" value={job.material} />
              <Info label="색상" value={job.color} />
              <Info label="노즐 구경" value={job.nozzle} />
              <Info label="예상 시간" value={job.estimatedTime || "—"} />
              <Info label="출력 설정" value={job.printSettings} />
              <Info label="우선순위" value={job.priority === "urgent" ? "긴급" : job.priority === "low" ? "낮음" : "일반"} />
            </div>
          </section>

          {/* [제4사분면 - 우하단]: 주문/고객 정보 및 작업 메모 */}
          <section aria-label="주문 및 메모" className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-black text-slate-600 mb-3 flex items-center gap-1.5">
                📋 주문 & 담당 정보
              </h3>
              <div className="grid grid-cols-2 gap-3.5 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <Info label="고객 / 주문처" value={job.customer || "미지정"} />
                <Info label="배정 작업자" value={job.operator || "미지정"} />
              </div>
            </div>

            {job.note ? (
              <div className="mt-3.5 rounded-xl bg-amber-50/80 p-3 border border-amber-200/80">
                <div className="mb-1 text-xs font-bold text-amber-800">📝 작업 메모</div>
                <p className="text-xs sm:text-sm font-medium text-amber-950 whitespace-pre-wrap">{job.note}</p>
              </div>
            ) : (
              <div className="mt-3.5 rounded-xl bg-slate-50 p-3 border border-slate-100 text-slate-400 text-xs text-center font-medium">
                등록된 메모가 없습니다
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
function Info({label,value}:{label:string;value:string}) { return <div><div className="mb-1 text-xs font-bold text-slate-400">{label}</div><div className="text-sm font-bold text-slate-800 break-all">{value}</div></div> }

function JobForm({initial,saving,onSave,onCancel}:{initial:Omit<Job,"id">|Job;saving:boolean;onSave:(j:Omit<Job,"id">|Job)=>void;onCancel:()=>void}) {
  const [f, setF] = useState(initial);
  const [isModelNameCustomized, setIsModelNameCustomized] = useState(Boolean(initial.modelName && initial.modelName !== cleanFileNameToBase(initial.fileName)));
  const set = (k: string, v: string | number) => setF(x => ({ ...x, [k]: v }));

  function handleFileNameChange(value: string) {
    const cleanBase = cleanFileNameToBase(value);
    setF(curr => ({
      ...curr,
      fileName: value,
      modelName: isModelNameCustomized ? curr.modelName : cleanBase
    }));
  }

  function handleModelNameChange(value: string) {
    if (value.trim() === "") {
      setIsModelNameCustomized(false);
      set("modelName", cleanFileNameToBase(f.fileName));
    } else {
      setIsModelNameCustomized(true);
      set("modelName", value);
    }
  }

  return (
    <form className="grid gap-4 pt-2" onSubmit={e => { e.preventDefault(); onSave(f); }}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="G-code / 파일명 (프린터 파일)">
          <Input
            value={f.fileName}
            onChange={e => handleFileNameChange(e.target.value)}
            placeholder="예: Motor_Holder_0.2.gcode"
          />
        </Field>
        <Field label="모델명 (작업명) *">
          <Input
            required
            value={f.modelName}
            onChange={e => handleModelNameChange(e.target.value)}
            placeholder="예: 모터 홀더"
          />
        </Field>
        <Field label="프린터"><Picker value={f.printer} onChange={v => set("printer", v)} options={printers} /></Field>
        <Field label="우선순위"><Picker value={f.priority} onChange={v => set("priority", v)} options={["urgent","normal","low"]} labels={{urgent:"긴급",normal:"일반",low:"낮음"}} /></Field>
        <Field label="수량"><Input type="number" min="1" value={f.quantity} onChange={e => set("quantity", Number(e.target.value))} /></Field>
        <Field label="완료 수량"><Input type="number" min="0" max={f.quantity} value={f.completedQuantity} onChange={e => set("completedQuantity", Number(e.target.value))} /></Field>
        <Field label="재료"><Input value={f.material} onChange={e => set("material", e.target.value)} placeholder="PLA" /></Field>
        <Field label="색상"><Input value={f.color} onChange={e => set("color", e.target.value)} placeholder="White" /></Field>
        <Field label="노즐"><Input value={f.nozzle} onChange={e => set("nozzle", e.target.value)} placeholder="0.4 mm" /></Field>
        <Field label="예상 출력시간"><Input value={f.estimatedTime} onChange={e => set("estimatedTime", e.target.value)} placeholder="3시간 20분" /></Field>
        <Field label="출력 설정"><Input value={f.printSettings} onChange={e => set("printSettings", e.target.value)} /></Field>
        <Field label="고객 / 주문"><Input value={f.customer} onChange={e => set("customer", e.target.value)} placeholder="KAIST" /></Field>
      </div>
      <Field label="작업 메모"><Textarea value={f.note} onChange={e => set("note", e.target.value)} placeholder="서포트 PETG Black" rows={3} /></Field>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving && <Loader2 className="animate-spin" />}
          {"id" in f && f.id ? "수정 저장" : "작업 추가"}
        </Button>
      </div>
    </form>
  );
}
function Field({label,children}:{label:string;children:React.ReactNode}) { return <div className="grid gap-2"><Label>{label}</Label>{children}</div> }
function Picker({value,onChange,options,labels={}}:{value:string;onChange:(v:string)=>void;options:string[];labels?:Record<string,string>}) { return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{options.map(o=><SelectItem key={o} value={o}>{labels[o]||o}</SelectItem>)}</SelectContent></Select> }

function ScreenshotForm({ initialPrinter, onSaved }: { initialPrinter: string; onSaved: (job: Job) => void }) {
  const [fields, setFields] = useState<Omit<Job, "id">>({ ...blank, printer: initialPrinter });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState("");
  const [isModelNameCustomized, setIsModelNameCustomized] = useState(false);

  const set = (key: keyof Omit<Job, "id">, value: string | number) => setFields(current => ({ ...current, [key]: value }));

  function handleFileNameChange(value: string) {
    const cleanBase = cleanFileNameToBase(value);
    setFields(curr => ({
      ...curr,
      fileName: value,
      modelName: isModelNameCustomized ? curr.modelName : cleanBase
    }));
  }

  function handleModelNameChange(value: string) {
    if (value.trim() === "") {
      setIsModelNameCustomized(false);
      set("modelName", cleanFileNameToBase(fields.fileName));
    } else {
      setIsModelNameCustomized(true);
      set("modelName", value);
    }
  }

  function setScreenshot(selected: File | undefined) {
    setUploaded("");
    if (!selected) return;
    if (!selected.type.startsWith("image/")) { toast.error("이미지 파일만 등록할 수 있습니다."); return; }
    if (selected.size > 10 * 1024 * 1024) { toast.error("10MB 이하 파일을 선택하세요."); return; }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));

    const cleanBase = cleanFileNameToBase(selected.name);
    setFields(curr => {
      const nextFileName = curr.fileName || selected.name;
      const nextModelName = isModelNameCustomized ? curr.modelName : (curr.modelName || cleanBase || "붙여넣은 스크린샷");
      return {
        ...curr,
        fileName: nextFileName,
        modelName: nextModelName
      };
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      let url = uploaded;
      if (!url && file) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/screenshots", { method: "POST", body: form });
        const data = await readUploadResponse(response);
        if (typeof data.url !== "string" || !data.url.startsWith("https://")) throw new Error("이미지 저장 주소를 받지 못했습니다. 다시 시도해 주세요.");
        url = data.url;
        setUploaded(url);
      }
      const finalModelName = fields.modelName.trim() || cleanFileNameToBase(fields.fileName) || file?.name || "새 작업";
      const finalFileName = fields.fileName.trim() || file?.name || "";
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, modelName: finalModelName, fileName: finalFileName, screenshot: url })
      });
      const data = await readUploadResponse(response);
      if (!data.job?.id) throw new Error("작업 등록 결과를 받지 못했습니다. 목록을 새로고침해 확인해 주세요.");
      onSaved(data.job);
      toast.success("작업을 등록했습니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} onPaste={event => { const image = Array.from(event.clipboardData.files).find(item => item.type.startsWith("image/")); if (image) { event.preventDefault(); setScreenshot(image); } }} className="grid gap-4">
      <div className="grid min-h-28 place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center outline-none transition focus-within:border-blue-500" tabIndex={0}>
        <div><b className="text-sm">스크린샷 붙여넣기</b><p className="mt-1 text-xs text-slate-500">이 영역을 클릭한 뒤 Ctrl/Cmd + V, 또는 아래에서 파일을 선택하세요.</p></div>
        <Input className="mt-3 max-w-xs bg-white" type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => setScreenshot(e.target.files?.[0])} />
      </div>
      {preview && <img src={preview} alt="등록할 스크린샷 미리보기" className="max-h-72 w-full rounded-lg border object-contain" />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="G-code / 파일명 (프린터 내 파일명)">
          <Input
            value={fields.fileName}
            onChange={e => handleFileNameChange(e.target.value)}
            placeholder="예: Motor_Holder_0.2.gcode"
          />
        </Field>
        <Field label="모델명 (작업명) *">
          <Input
            required
            value={fields.modelName}
            onChange={e => handleModelNameChange(e.target.value)}
            placeholder="예: 모터 홀더"
          />
        </Field>
        <Field label="프린터"><Picker value={fields.printer} onChange={value => set("printer", value)} options={printers} /></Field>
        <Field label="수량"><Input type="number" min="1" value={fields.quantity} onChange={e => set("quantity", Number(e.target.value))} /></Field>
        <Field label="완료 수량"><Input type="number" min="0" max={fields.quantity} value={fields.completedQuantity} onChange={e => set("completedQuantity", Number(e.target.value))} /></Field>
        <Field label="재료"><Input value={fields.material} onChange={e => set("material", e.target.value)} /></Field>
        <Field label="색상"><Input value={fields.color} onChange={e => set("color", e.target.value)} /></Field>
        <Field label="노즐"><Input value={fields.nozzle} onChange={e => set("nozzle", e.target.value)} /></Field>
        <Field label="예상 출력시간"><Input value={fields.estimatedTime} onChange={e => set("estimatedTime", e.target.value)} placeholder="3시간 20분" /></Field>
        <Field label="고객 / 주문"><Input value={fields.customer} onChange={e => set("customer", e.target.value)} /></Field>
        <Field label="우선순위"><Picker value={fields.priority} onChange={value => set("priority", value)} options={["urgent", "normal", "low"]} labels={{urgent:"긴급", normal:"일반", low:"낮음"}} /></Field>
        <Field label="출력 설정"><Input value={fields.printSettings} onChange={e => set("printSettings", e.target.value)} /></Field>
      </div>
      <Field label="작업 메모"><Textarea value={fields.note} onChange={e => set("note", e.target.value)} rows={3} /></Field>
      <p className="text-xs text-slate-500">PNG / JPG / WebP · 최대 10MB. 등록한 이미지는 공개 사이트 방문자에게 표시됩니다.</p>
      <Button disabled={busy} type="submit">{busy ? "등록 중…" : "작업 등록"}</Button>
    </form>
  );
}
