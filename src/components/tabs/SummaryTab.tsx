'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Landmark, Calendar, Building2, CheckCircle2, Sparkles, FileSpreadsheet,
} from 'lucide-react'
import { type Summary } from '@/lib/types'

interface SummaryTabProps {
  summary: Summary | null
  summaryLoading: boolean
}

export default function SummaryTab({ summary, summaryLoading }: SummaryTabProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
        {summaryLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}</div>
        ) : summary ? (
          <>
            <Card className="overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge className="text-[10px] h-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"><Landmark className="h-2.5 w-2.5 mr-1" />{summary.type}</Badge>
                  {summary.period && <Badge variant="outline" className="text-[10px] h-5"><Calendar className="h-2.5 w-2.5 mr-1" />{summary.period}</Badge>}
                </div>
                <CardTitle className="text-lg">{summary.title}</CardTitle>
                {summary.entity && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{summary.entity}</p>}
              </CardHeader>
              <CardContent><p className="text-sm leading-relaxed">{summary.summary}</p></CardContent>
            </Card>
            {summary.totalAmount && (
              <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center"><FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /></div>
                    <div><p className="text-xs text-muted-foreground">Total Anggaran</p><p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">Rp {summary.totalAmount}</p></div>
                  </div>
                </CardContent>
              </Card>
            )}
            {summary.keyPoints?.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500" />Poin-Poin Penting</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2.5">
                    {summary.keyPoints.map((point, i) => (
                      <li key={i} className="flex gap-2.5 text-sm">
                        <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0"><CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /></div>
                        <span className="leading-relaxed">{point}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </>
        ) : <div className="text-center py-12 text-muted-foreground text-sm">Ringkasan belum tersedia</div>}
      </div>
    </ScrollArea>
  )
}
