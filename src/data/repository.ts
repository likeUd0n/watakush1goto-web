import { planMerge, backupSize, type BackupData } from './backup'
import type { AppDb } from './db'
import type { AiSummary, AppData, Appointment, ConditionRecord, ConsultMemo, SleepRecord } from './entities'

// 保存と読み出し（Android 版 data/Repository.kt と同じ動き）

const byNum = (a: number, b: number) => a - b
const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export class Repository {
  constructor(private db: AppDb) {}

  /** 画面が使うデータ一式を読む */
  async load(): Promise<AppData> {
    const [sleeps, conds, memos, visits, appts, ai] = await Promise.all([
      this.db.sleep_records.toArray(),
      this.db.condition_records.toArray(),
      this.db.consult_memos.toArray(),
      this.db.visits.toArray(),
      this.db.appointments.toArray(),
      this.db.ai_summaries.toArray(),
    ])
    conds.sort((a, b) => byStr(a.date, b.date) || byNum(a.timeMin, b.timeMin) || byNum(a.id ?? 0, b.id ?? 0))
    memos.sort((a, b) => byNum(b.createdAt, a.createdAt) || byNum(b.id ?? 0, a.id ?? 0))
    visits.sort((a, b) => byStr(b.date, a.date) || byNum(b.createdAt, a.createdAt))
    const conditions: Record<string, ConditionRecord[]> = {}
    for (const c of conds) (conditions[c.date] ??= []).push(c)
    return {
      sleeps: Object.fromEntries(sleeps.map((s) => [s.date, s])),
      conditions,
      memos: memos.filter((m) => m.talkedAt == null),
      talked: memos.filter((m) => m.talkedAt != null).sort((a, b) => byNum(b.talkedAt!, a.talkedAt!)),
      visits,
      appointments: Object.fromEntries(appts.map((a) => [a.kind, a])),
      aiSummaries: Object.fromEntries(ai.map((a) => [a.kind, a])),
    }
  }

  // ---- 睡眠 ----
  /** いちばん新しい記録(睡眠画面の初期値に使う) */
  latestSleep = () => this.db.sleep_records.orderBy('date').last()
  saveSleep = (r: SleepRecord) => this.db.sleep_records.put({ ...r, updatedAt: Date.now() })
  restoreSleep = (r: SleepRecord) => this.db.sleep_records.put(r)

  /** 消して、元に戻すための記録を返す */
  async deleteSleep(date: string): Promise<SleepRecord | undefined> {
    const old = await this.db.sleep_records.get(date)
    await this.db.sleep_records.delete(date)
    return old
  }

  // ---- 調子 ----
  addCondition = (r: ConditionRecord) => {
    const { id: _, ...rest } = r
    return this.db.condition_records.add(rest)
  }
  updateCondition = (r: ConditionRecord) => this.db.condition_records.put({ ...r, updatedAt: Date.now() })
  restoreCondition = (r: ConditionRecord) => this.db.condition_records.put(r)
  deleteCondition = (r: ConditionRecord) => this.db.condition_records.delete(r.id!)

  // ---- 話すこと ----
  addMemo = (text: string, kind: string | null, pinned: boolean) =>
    this.db.consult_memos.add({ text, kind, pinned, createdAt: Date.now(), talkedAt: null }) as Promise<number>
  updateMemo = (m: ConsultMemo) => this.db.consult_memos.put(m)
  restoreMemo = (m: ConsultMemo) => this.db.consult_memos.put(m)
  deleteMemo = (m: ConsultMemo) => this.db.consult_memos.delete(m.id!)

  /** 「話したこと」を「話すこと」へ戻す */
  returnTalked = (m: ConsultMemo) => this.db.consult_memos.put({ ...m, talkedAt: null })

  /** AIの答えの「メモ: #番号」で、話すことの相手を付け替える。本人が固定指定(pinned)したメモは上書きしない */
  tagMemos(tags: Map<number, string>): Promise<number> {
    return this.db.transaction('rw', this.db.consult_memos, async () => {
      const open = new Map((await this.db.consult_memos.toArray()).filter((m) => m.talkedAt == null).map((m) => [m.id!, m]))
      const changed: ConsultMemo[] = []
      for (const [id, kind] of tags) {
        const m = open.get(id)
        if (m && !m.pinned) changed.push({ ...m, kind })
      }
      await this.db.consult_memos.bulkPut(changed)
      return changed.length
    })
  }

  // ---- 診察・カウンセリングの記録 ----
  /**
   * 記録を残す。チェックした話すことは「話したこと」へ移し、その相手の「AIの整理」を消す。
   * 記録日以前の予定は済んだものとして消し、次の予定が入っていれば置き換える
   */
  recordVisit(kind: string, date: string, talkedIds: Set<number>, feedback: string, next: Appointment | null): Promise<void> {
    const d = this.db
    return d.transaction('rw', [d.consult_memos, d.visits, d.ai_summaries, d.appointments], async () => {
      const now = Date.now()
      const done = (await d.consult_memos.toArray()).filter((m) => m.talkedAt == null && talkedIds.has(m.id!))
      await d.consult_memos.bulkPut(done.map((m) => ({ ...m, talkedAt: now })))
      await d.visits.add({
        date,
        kind,
        talkedSummary: done.map((m) => m.text).join(' / ') || '-',
        feedback: feedback.trim() === '' ? '-' : feedback,
        createdAt: now,
      })
      await d.ai_summaries.delete(kind)
      const current = await d.appointments.get(kind)
      if (current && current.date <= date) await d.appointments.delete(kind)
      if (next) await d.appointments.put({ ...next, kind })
    })
  }

  // ---- 次の予定 ----
  /** 相手ごとに置き換える。null なら消す */
  setAppointments(values: Record<string, Appointment | null>): Promise<void> {
    return this.db.transaction('rw', this.db.appointments, async () => {
      for (const [kind, a] of Object.entries(values)) {
        if (a == null) await this.db.appointments.delete(kind)
        else await this.db.appointments.put({ ...a, kind })
      }
    })
  }

  // ---- AIの整理 ----
  saveAiSummaries(texts: Record<string, string>): Promise<void> {
    return this.db.transaction('rw', this.db.ai_summaries, async () => {
      await this.db.ai_summaries.clear()
      const now = Date.now()
      await this.db.ai_summaries.bulkPut(Object.entries(texts).map(([kind, text]) => ({ kind, text, savedAt: now })))
    })
  }

  /** 全部消して、元に戻すための一覧を返す */
  async clearAiSummaries(): Promise<AiSummary[]> {
    const old = await this.db.ai_summaries.toArray()
    await this.db.ai_summaries.clear()
    return old
  }

  restoreAiSummaries = (list: AiSummary[]) => this.db.ai_summaries.bulkPut(list)

  // ---- バックアップ ----
  async snapshot(): Promise<BackupData> {
    const [sleeps, conditions, memos, visits, appointments, aiSummaries] = await Promise.all([
      this.db.sleep_records.orderBy('date').toArray(),
      this.db.condition_records.toArray(),
      this.db.consult_memos.toArray(),
      this.db.visits.toArray(),
      this.db.appointments.toArray(),
      this.db.ai_summaries.toArray(),
    ])
    return { sleeps, conditions, memos, visits, appointments, aiSummaries }
  }

  /** 読み込んだものを今のデータに足す(消すことはしない)。足した・置き換えた件数を返す */
  merge(incoming: BackupData): Promise<number> {
    const d = this.db
    return d.transaction('rw', [d.sleep_records, d.condition_records, d.consult_memos, d.visits, d.appointments, d.ai_summaries], async () => {
      const plan = planMerge(await this.snapshot(), incoming)
      const noId = <T extends { id?: number }>(x: T): T => {
        const { id: _, ...rest } = x
        return rest as T
      }
      await d.sleep_records.bulkPut(plan.sleeps)
      await d.appointments.bulkPut(plan.appointments)
      await d.ai_summaries.bulkPut(plan.aiSummaries)
      await d.condition_records.bulkAdd(plan.conditions.map(noId))
      await d.consult_memos.bulkAdd(plan.memos.map(noId))
      await d.visits.bulkAdd(plan.visits.map(noId))
      return backupSize(plan)
    })
  }
}
