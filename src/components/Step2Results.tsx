import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BookOpen, Loader2, Network, ArrowLeft, Download } from 'lucide-react'
import { MarkdownCard } from './MarkdownCard'
import { MindMapCard } from './MindMapCard'
import type { MindElixirData, Options } from 'mind-elixir'
import type { ChapterData } from '../services/epubProcessor'
import { openInMindElixir, downloadMindMap } from '../utils'

interface Chapter {
  id: string
  title: string
  content: string
  summary?: string
  mindMap?: MindElixirData
  isLoading?: boolean
}

interface BookSummary {
  title: string
  author: string
  chapters: Chapter[]
  connections: string
  overallSummary: string
}

interface BookMindMap {
  title: string
  author: string
  chapters: Chapter[]
  combinedMindMap: MindElixirData | null
}

interface Step2ResultsProps {
  processing: boolean
  extractingChapters: boolean
  progress: number
  currentStep: string
  error: string | null
  bookSummary: BookSummary | null
  bookMindMap: BookMindMap | null
  bookData: { title: string; author: string } | null
  processingMode: 'summary' | 'mindmap' | 'combined-mindmap'
  extractedChapters: ChapterData[] | null
  options: Options
  onBackToConfig: () => void
  onClearChapterCache: (chapterId: string) => void
  onClearSpecificCache: (cacheType: 'connections' | 'overall_summary' | 'combined_mindmap' | 'merged_mindmap') => void
  onDownloadAllMarkdown: () => void
  onSetCurrentReadingChapter: (chapter: ChapterData) => void
  t: (key: string, options?: any) => string
}

export function Step2Results({
  processing,
  extractingChapters,
  progress,
  currentStep,
  error,
  bookSummary,
  bookMindMap,
  bookData,
  processingMode,
  extractedChapters,
  options,
  onBackToConfig,
  onClearChapterCache,
  onClearSpecificCache,
  onDownloadAllMarkdown,
  onSetCurrentReadingChapter,
  t
}: Step2ResultsProps) {
  return (
    <div className='min-h-[80vh] space-y-4'>
      {/* 步骤2: 处理过程和结果显示 */}
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="outline"
          onClick={onBackToConfig}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.backToConfig')}
        </Button>
        <div className="text-lg font-medium text-gray-700 truncate">
          {bookData ? `${bookData.title} - ${bookData.author}` : '处理中...'}
        </div>
      </div>
      
      {/* 处理进度 */}
      {(processing || extractingChapters || error) && (
        <Card>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-2">
                  {error ? (
                    <span className="text-red-500 font-medium">Error: {error}</span>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{currentStep}</span>
                    </>
                  )}
                </div>
                <span>{error ? '' : `${Math.round(progress)}%`}</span>
              </div>
              <Progress value={error ? 0 : progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 结果展示 */}
      {(bookSummary || bookMindMap) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="truncate flex-1 w-1">
                {processingMode === 'summary' ? (
                  <><BookOpen className="h-5 w-5 inline-block mr-2" />{t('results.summaryTitle', { title: bookSummary?.title })}</>
                ) : processingMode === 'mindmap' ? (
                  <><Network className="h-5 w-5 inline-block mr-2" />{t('results.chapterMindMapTitle', { title: bookMindMap?.title })}</>
                ) : (
                  <><Network className="h-5 w-5 inline-block mr-2" />{t('results.wholeMindMapTitle', { title: bookMindMap?.title })}</>
                )}
              </div>
              {processingMode === 'summary' && bookSummary && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDownloadAllMarkdown}
                  className="flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {t('download.downloadAllMarkdown')}
                </Button>
              )}
            </CardTitle>
            <CardDescription>
              {t('results.author', { author: bookSummary?.author || bookMindMap?.author })} | {t('results.chapterCount', { count: bookSummary?.chapters.length || bookMindMap?.chapters.length })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processingMode === 'summary' && bookSummary ? (
              <Tabs defaultValue="chapters" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="chapters">{t('results.tabs.chapterSummary')}</TabsTrigger>
                  <TabsTrigger value="connections">{t('results.tabs.connections')}</TabsTrigger>
                  <TabsTrigger value="overall">{t('results.tabs.overallSummary')}</TabsTrigger>
                </TabsList>

                <TabsContent value="chapters" className="grid grid-cols-1 gap-4">
                  {bookSummary.chapters.map((chapter, index) => (
                    <MarkdownCard
                      key={chapter.id}
                      id={chapter.id}
                      title={chapter.title}
                      content={chapter.content}
                      markdownContent={chapter.summary || ''}
                      index={index}
                      defaultCollapsed={index > 0}
                      onClearCache={onClearChapterCache}
                      isLoading={chapter.isLoading}
                      onReadChapter={() => {
                        // 根据章节ID找到对应的ChapterData
                        const chapterData = extractedChapters?.find(ch => ch.id === chapter.id)
                        if (chapterData) {
                          onSetCurrentReadingChapter(chapterData)
                        }
                      }}
                    />
                  ))}
                </TabsContent>

                <TabsContent value="connections">
                  <MarkdownCard
                    id="connections"
                    title={t('results.tabs.connections')}
                    content={bookSummary.connections}
                    markdownContent={bookSummary.connections}
                    index={0}
                    showClearCache={true}
                    showViewContent={false}
                    showCopyButton={true}
                    onClearCache={() => onClearSpecificCache('connections')}
                  />
                </TabsContent>

                <TabsContent value="overall">
                  <MarkdownCard
                    id="overall"
                    title={t('results.tabs.overallSummary')}
                    content={bookSummary.overallSummary}
                    markdownContent={bookSummary.overallSummary}
                    index={0}
                    showClearCache={true}
                    showViewContent={false}
                    showCopyButton={true}
                    onClearCache={() => onClearSpecificCache('overall_summary')}
                  />
                </TabsContent>
              </Tabs>
            ) : processingMode === 'mindmap' && bookMindMap ? (
              <Tabs defaultValue="chapters" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chapters">{t('results.tabs.chapterMindMaps')}</TabsTrigger>
                  <TabsTrigger value="combined">{t('results.tabs.combinedMindMap')}</TabsTrigger>
                </TabsList>

                <TabsContent value="chapters" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {bookMindMap.chapters.map((chapter, index) => {
                    return (
                      <MindMapCard
                        key={chapter.id}
                        id={chapter.id}
                        title={chapter.title}
                        isLoading={chapter.isLoading}
                        content={chapter.content}
                        mindMapData={chapter.mindMap || { nodeData: { topic: '', id: '', children: [] } }}
                        index={index}
                        showCopyButton={false}
                        onClearCache={onClearChapterCache}
                        onOpenInMindElixir={openInMindElixir}
                        onDownloadMindMap={downloadMindMap}
                        onReadChapter={() => {
                          // 根据章节ID找到对应的ChapterData
                          const chapterData = extractedChapters?.find(ch => ch.id === chapter.id)
                          if (chapterData) {
                            onSetCurrentReadingChapter(chapterData)
                          }
                        }}
                        mindElixirOptions={options}
                      />
                    )
                  })}
                </TabsContent>

                <TabsContent value="combined">
                  {bookMindMap.combinedMindMap ? (
                    <MindMapCard
                      id="combined"
                      title={t('results.tabs.combinedMindMap')}
                      content=""
                      mindMapData={bookMindMap.combinedMindMap}
                      index={0}
                      onOpenInMindElixir={(mindmapData) => openInMindElixir(mindmapData, t('results.combinedMindMapTitle', { title: bookMindMap.title }))}
                      onDownloadMindMap={downloadMindMap}
                      onClearCache={() => onClearSpecificCache('merged_mindmap')}
                      showClearCache={true}
                      showViewContent={false}
                      showCopyButton={false}
                      mindMapClassName="w-full h-[600px] mx-auto"
                      mindElixirOptions={options}
                    />
                  ) : (
                    <Card>
                      <CardContent>
                        <div className="text-center text-gray-500 py-8">
                          {t('results.generatingMindMap')}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            ) : processingMode === 'combined-mindmap' && bookMindMap ? (
              bookMindMap.combinedMindMap ? (
                <MindMapCard
                  id="whole-book"
                  title={t('results.tabs.combinedMindMap')}
                  content=""
                  mindMapData={bookMindMap.combinedMindMap}
                  index={0}
                  onOpenInMindElixir={(mindmapData) => openInMindElixir(mindmapData, t('results.combinedMindMapTitle', { title: bookMindMap.title }))}
                  onDownloadMindMap={downloadMindMap}
                  onClearCache={() => onClearSpecificCache('combined_mindmap')}
                  showClearCache={true}
                  showViewContent={false}
                  showCopyButton={false}
                  mindMapClassName="w-full h-[600px] mx-auto"
                  mindElixirOptions={options}
                />
              ) : (
                <Card>
                  <CardContent>
                    <div className="text-center text-gray-500 py-8">
                      {t('results.generatingMindMap')}
                    </div>
                  </CardContent>
                </Card>
              )
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  )
}