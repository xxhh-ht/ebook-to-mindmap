import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Upload, BookOpen, Brain, FileText, Loader2, List } from 'lucide-react'
import { ConfigDialog } from './project/ConfigDialog'
import { toast } from 'sonner'
import type { ChapterData } from '../services/epubProcessor'

interface Step1UploadProps {
  file: File | null
  processing: boolean
  extractingChapters: boolean
  extractedChapters: ChapterData[] | null
  bookData: { title: string; author: string } | null
  selectedChapters: Set<string>
  customPrompt: string
  apiKey: string
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onClearBookCache: () => void
  onExtractChapters: () => void
  onChapterSelect: (chapterId: string, checked: boolean) => void
  onSelectAll: (checked: boolean) => void
  onCustomPromptChange: (value: string) => void
  onProcessEbook: () => void
  onSetCurrentReadingChapter: (chapter: ChapterData) => void
  t: (key: string, options?: any) => string
}

// 辅助函数：计算字符串大小（KB）
function getStringSizeInKB(str: string): string {
  const sizeInKB = new Blob([str]).size / 1024;
  return sizeInKB.toFixed(1);
}

export function Step1Upload({
  file,
  processing,
  extractingChapters,
  extractedChapters,
  bookData,
  selectedChapters,
  customPrompt,
  apiKey,
  onFileChange,
  onClearBookCache,
  onExtractChapters,
  onChapterSelect,
  onSelectAll,
  onCustomPromptChange,
  onProcessEbook,
  onSetCurrentReadingChapter,
  t
}: Step1UploadProps) {
  return (
    <div className='min-h-[80vh] space-y-4'>
      {/* 步骤1: 文件上传和配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {t('upload.title')}
          </CardTitle>
          <CardDescription>
            {t('upload.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="file">{t('upload.selectFile')}</Label>
            <Input
              id="file"
              type="file"
              accept=".epub,.pdf"
              onChange={onFileChange}
              disabled={processing}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              {t('upload.selectedFile')}: {file?.name || t('upload.noFileSelected')}
            </div>
            <div className="flex items-center gap-2">
              <ConfigDialog processing={processing} file={file} />
              <Button
                variant="outline"
                size="sm"
                onClick={onClearBookCache}
                disabled={!file || processing}
                className="flex items-center gap-1 text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <FileText className="h-3.5 w-3.5" />
                {t('upload.clearCache')}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Button
              onClick={onExtractChapters}
              disabled={!file || extractingChapters || processing}
              className="w-full"
            >
              {extractingChapters ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('upload.extractingChapters')}
                </>
              ) : (
                <>
                  <List className="mr-2 h-4 w-4" />
                  {t('upload.extractChapters')}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* 章节信息 */}
      {extractedChapters && bookData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              {t('chapters.title')}
            </CardTitle>
            <CardDescription>
              {bookData.title} - {bookData.author} | {t('chapters.totalChapters', { count: extractedChapters.length })}，{t('chapters.selectedChapters', { count: selectedChapters.size })}
            </CardDescription>
            <div className="flex items-center gap-2 mt-2">
              <Checkbox
                id="select-all"
                checked={selectedChapters.size === extractedChapters.length}
                onCheckedChange={(checked) => onSelectAll(checked as boolean)}
              />
              <Label htmlFor="select-all" className="text-sm font-medium">
                {t('chapters.selectAll')}
              </Label>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {extractedChapters.map((chapter) => (
                <div key={chapter.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <Checkbox
                    id={`chapter-${chapter.id}`}
                    checked={selectedChapters.has(chapter.id)}
                    onCheckedChange={(checked) => onChapterSelect(chapter.id, checked as boolean)}
                  />
                  <div className="flex-1 min-w-0">
                    <Label
                      htmlFor={`chapter-${chapter.id}`}
                      className="text-sm truncate cursor-pointer block"
                      title={chapter.title}
                    >
                      {chapter.title}
                    </Label>
                    <span className="text-xs text-gray-500">
                      {getStringSizeInKB(chapter.content)} KB
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSetCurrentReadingChapter(chapter)}
                  >
                    <BookOpen className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* 自定义提示词输入框 */}
            <div className="space-y-2">
              <Label htmlFor="custom-prompt" className="text-sm font-medium">
                {t('chapters.customPrompt')}
              </Label>
              <Textarea
                id="custom-prompt"
                placeholder={t('chapters.customPromptPlaceholder')}
                value={customPrompt}
                onChange={(e) => onCustomPromptChange(e.target.value)}
                className="min-h-20 resize-none"
                disabled={processing || extractingChapters}
              />
              <p className="text-xs text-gray-500">
                {t('chapters.customPromptDescription')}
              </p>
            </div>

            <Button
              onClick={() => {
                if (!apiKey) {
                  toast.error(t('chapters.apiKeyRequired'), {
                    duration: 3000,
                    position: 'top-center',
                  })
                  return
                }
                onProcessEbook()
              }}
              disabled={!extractedChapters || processing || extractingChapters || selectedChapters.size === 0}
              className="w-full"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('chapters.processing')}
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  {t('chapters.startProcessing')}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}