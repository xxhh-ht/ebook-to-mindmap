import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { ChevronUp } from 'lucide-react'
import { EpubProcessor, type ChapterData, type BookData as EpubBookData } from './services/epubProcessor'
import { PdfProcessor, type BookData as PdfBookData } from './services/pdfProcessor'
import { AIService } from './services/aiService'
import { CacheService } from './services/cacheService'
import type { MindElixirData, Options } from 'mind-elixir'
import type { Summary } from 'node_modules/mind-elixir/dist/types/summary'
import { LanguageSwitcher } from './components/LanguageSwitcher'
import { EpubReader } from './components/EpubReader'
import { PdfReader } from './components/PdfReader'
import { Step1Upload } from './components/Step1Upload'
import { Step2Results } from './components/Step2Results'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { scrollToTop } from './utils'


const options = { direction: 1, alignment: 'nodes' } as Options

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

// 导入配置store
import { useAIConfig, useProcessingOptions, useConfigStore } from './stores/configStore'
const cacheService = new CacheService()

// 辅助函数：计算字符串大小（KB）

function App() {
  const { t } = useTranslation()
  const [currentStepIndex, setCurrentStepIndex] = useState(1) // 1: 配置步骤, 2: 处理步骤
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [extractingChapters, setExtractingChapters] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [bookSummary, setBookSummary] = useState<BookSummary | null>(null)
  const [bookMindMap, setBookMindMap] = useState<BookMindMap | null>(null)
  const [extractedChapters, setExtractedChapters] = useState<ChapterData[] | null>(null)
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set())
  const [bookData, setBookData] = useState<{ title: string; author: string } | null>(null)
  const [fullBookData, setFullBookData] = useState<EpubBookData | PdfBookData | null>(null)
  const [customPrompt, setCustomPrompt] = useState('')
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [currentReadingChapter, setCurrentReadingChapter] = useState<ChapterData | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)



  // 使用zustand store管理配置
  const aiConfig = useAIConfig()
  const processingOptions = useProcessingOptions()

  // 从store中解构状态值
  const { apiKey } = aiConfig
  const { processingMode, bookType, useSmartDetection, skipNonEssentialChapters, forceUseSpine } = processingOptions

  // zustand的persist中间件会自动处理配置的加载和保存

  // 监听滚动事件，控制回到顶部按钮显示
  useEffect(() => {
    const scrollContainer = document.querySelector('.scroll-container')
    if (!scrollContainer) return

    const handleScroll = () => {
      setShowBackToTop(scrollContainer.scrollTop > 300)
    }

    scrollContainer.addEventListener('scroll', handleScroll)
    return () => scrollContainer.removeEventListener('scroll', handleScroll)
  }, [])



  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && (selectedFile.name.endsWith('.epub') || selectedFile.name.endsWith('.pdf'))) {
      setFile(selectedFile)
      // 重置章节提取状态
      setExtractedChapters(null)
      setSelectedChapters(new Set())
      setBookData(null)
      setFullBookData(null)
      setBookSummary(null)
      setBookMindMap(null)
      setCurrentReadingChapter(null)
    } else {
      toast.error(t('upload.invalidFile'), {
        duration: 3000,
        position: 'top-center',
      })
    }
  }, [t])

  // 清除章节缓存的函数
  const clearChapterCache = (chapterId: string) => {
    if (!file) return

    const type = processingMode === 'summary' ? 'summary' : 'mindmap'
    if (cacheService.clearChapterCache(file.name, chapterId, type)) {
      toast.success('已清除缓存，下次处理将重新生成内容', {
        duration: 3000,
        position: 'top-center',
      })
    }
  }

  // 清除特定类型缓存的函数
  const clearSpecificCache = (cacheType: 'connections' | 'overall_summary' | 'combined_mindmap' | 'merged_mindmap') => {
    if (!file) return

    const displayNames = {
      connections: '章节关联',
      overall_summary: '全书总结',
      combined_mindmap: '整书思维导图',
      merged_mindmap: '章节思维导图整合'
    }

    if (cacheService.clearSpecificCache(file.name, cacheType)) {
      toast.success(`已清除${displayNames[cacheType]}缓存，下次处理将重新生成内容`, {
        duration: 3000,
        position: 'top-center',
      })
    } else {
      toast.info(`没有找到可清除的${displayNames[cacheType]}缓存`, {
        duration: 3000,
        position: 'top-center',
      })
    }
  }

  // 下载整合的所有markdown文本
  const downloadAllMarkdown = () => {
    if (!bookSummary) return

    let markdownContent = `# ${bookSummary.title}

**${t('results.author', { author: bookSummary.author })}**

---

`

    // 添加章节总结
    markdownContent += `## ${t('results.tabs.chapterSummary')}\n\n`
    bookSummary.chapters.forEach((chapter) => {
      markdownContent += `${chapter.summary || ''}\n\n`
    })

    markdownContent += `---\n\n`

    // 添加章节关联
    if (bookSummary.connections) {
      markdownContent += `## ${t('results.tabs.connections')}

${bookSummary.connections}

---

`
    }

    // 添加全书总结
    if (bookSummary.overallSummary) {
      markdownContent += `## ${t('results.tabs.overallSummary')}

${bookSummary.overallSummary}

`
    }

    // 创建下载链接
    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${bookSummary.title}_${t('results.tabs.overallSummary')}.md`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success(t('download.markdownDownloaded'), {
      duration: 3000,
      position: 'top-center',
    })
  }

  // 章节选择处理函数
  const handleChapterSelect = useCallback((chapterId: string, checked: boolean) => {
    setSelectedChapters((prev: Set<string>) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(chapterId)
      } else {
        newSet.delete(chapterId)
      }

      // 实时更新选中的章节缓存
      if (file) {
        cacheService.setSelectedChapters(file.name, newSet)
        console.log('💾 [DEBUG] 实时更新选中的章节缓存:', newSet.size)
      }

      return newSet
    })
  }, [file])

  // 全选/取消全选处理函数
  const handleSelectAll = useCallback((checked: boolean) => {
    if (!extractedChapters) return

    const newSelectedChapters: Set<string> = checked
      ? new Set(extractedChapters.map(chapter => chapter.id))
      : new Set()

    setSelectedChapters(newSelectedChapters)

    // 更新选中的章节缓存
    if (file) {
      cacheService.setSelectedChapters(file.name, newSelectedChapters)
      console.log('💾 [DEBUG] 全选操作更新选中的章节缓存:', newSelectedChapters.size)
    }
  }, [extractedChapters, file])

  // 清除整本书缓存的函数
  const clearBookCache = () => {
    if (!file) return

    const mode = processingMode === 'combined-mindmap' ? 'combined_mindmap' : processingMode as 'summary' | 'mindmap'
    const deletedCount = cacheService.clearBookCache(file.name, mode)

    const modeNames = {
      'summary': '文字总结',
      'mindmap': '章节思维导图',
      'combined-mindmap': '整书思维导图'
    }

    if (deletedCount > 0) {
      toast.success(`已清除${deletedCount}项${modeNames[processingMode]}缓存，下次处理将重新生成内容`, {
        duration: 3000,
        position: 'top-center',
      })
    } else {
      toast.info(`没有找到可清除的${modeNames[processingMode]}缓存`, {
        duration: 3000,
        position: 'top-center',
      })
    }
  }

  // 提取章节的函数
  const extractChapters = useCallback(async () => {
    if (!file) {
      toast.error(t('upload.pleaseSelectFile'), {
        duration: 3000,
        position: 'top-center',
      })
      return
    }

    setExtractingChapters(true)
    setProgress(0)
    setCurrentStep('')
    setError(null) // 清除之前的错误状态

    // 创建新的AbortController
    abortControllerRef.current = new AbortController()

    try {
      let extractedBookData: { title: string; author: string }
      let chapters: ChapterData[]

      const isEpub = file.name.endsWith('.epub')
      const isPdf = file.name.endsWith('.pdf')

      if (isEpub) {
        const processor = new EpubProcessor()
        setCurrentStep('正在解析 EPUB 文件...')
        const bookData = await processor.parseEpub(file)
        extractedBookData = { title: bookData.title, author: bookData.author }
        setFullBookData(bookData) // 保存完整的BookData对象
        setProgress(50)
        
        setCurrentStep('正在提取章节内容...')
        chapters = await processor.extractChapters(bookData.book, useSmartDetection, skipNonEssentialChapters, processingOptions.maxSubChapterDepth, forceUseSpine)
      } else if (isPdf) {
        const processor = new PdfProcessor()
        setCurrentStep('正在解析 PDF 文件...')
        const bookData = await processor.parsePdf(file)
        extractedBookData = { title: bookData.title, author: bookData.author }
        setFullBookData(bookData) // 保存完整的BookData对象
        setProgress(50)
        
        setCurrentStep('正在提取章节内容...')
        chapters = await processor.extractChapters(file, useSmartDetection, skipNonEssentialChapters, processingOptions.maxSubChapterDepth)
      } else {
        throw new Error('不支持的文件格式')
      }
      setProgress(100)

      setBookData(extractedBookData)
      setExtractedChapters(chapters)

      // 尝试从缓存中加载选中的章节
      const cachedSelectedChapters = cacheService.getSelectedChapters(file.name)
      let newSelectedChapters: Set<string>

      if (cachedSelectedChapters && cachedSelectedChapters.length > 0) {
        // 验证缓存的章节ID是否仍然有效
        const validChapterIds = chapters.map(chapter => chapter.id)
        const validSelectedChapters = cachedSelectedChapters.filter(id => validChapterIds.includes(id))

        if (validSelectedChapters.length > 0) {
          newSelectedChapters = new Set(validSelectedChapters)
          console.log('✅ [DEBUG] 从缓存加载了选中的章节:', validSelectedChapters.length)
        } else {
          // 缓存的章节ID无效，使用默认选中所有章节
          newSelectedChapters = new Set(chapters.map(chapter => chapter.id))
          console.log('⚠️ [DEBUG] 缓存的章节ID无效，使用默认选中所有章节')
        }
      } else {
        // 没有缓存，使用默认选中所有章节
        newSelectedChapters = new Set(chapters.map(chapter => chapter.id))
      }

      // 更新选中章节状态
      setSelectedChapters(newSelectedChapters as Set<string>)

      // 缓存选中的章节
      cacheService.setSelectedChapters(file.name, newSelectedChapters as Set<string>)
      console.log('💾 [DEBUG] 已缓存选中的章节:', newSelectedChapters.size)

      setCurrentStep(t('progress.chaptersExtracted', { count: chapters.length }))

      toast.success(t('progress.successfullyExtracted', { count: chapters.length }), {
        duration: 3000,
        position: 'top-center',
      })
    } catch (err) {
      // 如果是AbortError，不显示错误信息
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(t('common.generationCancelled'))
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : t('progress.extractionError')
      setError(errorMessage)
      toast.error(errorMessage, {
        duration: 5000,
        position: 'top-center',
      })
    } finally {
      setExtractingChapters(false)
      // 清理AbortController
      if (abortControllerRef.current) {
        abortControllerRef.current = null
      }
    }
  }, [file, useSmartDetection, skipNonEssentialChapters, processingOptions.maxSubChapterDepth, forceUseSpine, t, error])

  const processEbook = useCallback(async () => {
    if (!extractedChapters || !bookData || !apiKey) {
      toast.error(t('chapters.extractAndApiKey'), {
        duration: 3000,
        position: 'top-center',
      })
      return
    }
    if (!file) return

    if (selectedChapters.size === 0) {
      toast.error(t('chapters.selectAtLeastOne'), {
        duration: 3000,
        position: 'top-center',
      })
      return
    }

    // 跳转到步骤2并开始处理
    setCurrentStepIndex(2)
    setBookSummary(null)
    setBookMindMap(null)
    setProcessing(true)
    setProgress(0)
    setCurrentStep('')
    setError(null) // 清除之前的错误状态

    // 创建新的AbortController
    abortControllerRef.current = new AbortController()
    const abortSignal = abortControllerRef.current.signal

    try {
      const aiService = new AIService(() => {
        const currentState = useConfigStore.getState()
        const currentAiConfig = currentState.aiConfig
        return {
          provider: currentAiConfig.provider,
          apiKey: currentAiConfig.apiKey,
          apiUrl: currentAiConfig.apiUrl,
          model: currentAiConfig.model || undefined,
          temperature: currentAiConfig.temperature
        }
      })

      // 只处理选中的章节
      const chapters = extractedChapters.filter(chapter => selectedChapters.has(chapter.id))

      const totalChapters = chapters.length
      const processedChapters: Chapter[] = []

      // 根据模式初始化状态
      if (processingMode === 'summary') {
        setBookSummary({
          title: bookData.title,
          author: bookData.author,
          chapters: [],
          connections: '',
          overallSummary: ''
        })
      } else if (processingMode === 'mindmap' || processingMode === 'combined-mindmap') {
        setBookMindMap({
          title: bookData.title,
          author: bookData.author,
          chapters: [],
          combinedMindMap: null
        })
      }

      // 步骤3: 逐章处理
      for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i]
        setCurrentStep(`正在处理第 ${i + 1}/${totalChapters} 章: ${chapter.title}`)

        // 推入一个loading状态的item
        const loadingChapter: Chapter = {
          id: chapter.id,
          title: chapter.title,
          content: chapter.content,
          isLoading: true
        }

        if (processingMode === 'summary') {
          setBookSummary(prevSummary => ({
            ...prevSummary!,
            chapters: [...(prevSummary?.chapters || []), loadingChapter]
          }))
        } else if (processingMode === 'mindmap') {
          setBookMindMap(prevMindMap => ({
            ...prevMindMap!,
            chapters: [...(prevMindMap?.chapters || []), loadingChapter]
          }))
        }

        let processedChapter: Chapter

        if (processingMode === 'summary') {
          // 文字总结模式
          let summary = cacheService.getString(file.name, 'summary', chapter.id)

          if (!summary) {
            summary = await aiService.summarizeChapter(chapter.title, chapter.content, bookType, processingOptions.outputLanguage, customPrompt, abortSignal)
            cacheService.setCache(file.name, 'summary', summary, chapter.id)
          }

          processedChapter = {
            ...chapter,
            summary,
            isLoading: false
          }

          processedChapters.push(processedChapter)

          // 替换loading状态的章节为处理完成的章节
          setBookSummary(prevSummary => ({
            ...prevSummary!,
            chapters: [...processedChapters]
          }))
        } else if (processingMode === 'mindmap') {
          // 章节思维导图模式
          let mindMap = cacheService.getMindMap(file.name, 'mindmap', chapter.id)

          if (!mindMap) {
            mindMap = await aiService.generateChapterMindMap(chapter.content, processingOptions.outputLanguage, customPrompt, abortSignal)
            cacheService.setCache(file.name, 'mindmap', mindMap, chapter.id)
          }

          if (!mindMap.nodeData) continue // 无需总结的章节
          processedChapter = {
            ...chapter,
            mindMap,
            isLoading: false
          }

          processedChapters.push(processedChapter)

          // 替换loading状态的章节为处理完成的章节
          setBookMindMap(prevMindMap => ({
            ...prevMindMap!,
            chapters: [...processedChapters]
          }))
        } else if (processingMode === 'combined-mindmap') {
          // 整书思维导图模式 - 只收集章节内容，不生成单独的思维导图
          processedChapter = {
            ...chapter,
            isLoading: false
          }

          processedChapters.push(processedChapter)

          setBookMindMap(prevMindMap => ({
            ...prevMindMap!,
            chapters: [...processedChapters]
          }))
        }

        setProgress(20 + (i + 1) / totalChapters * 60)
      }

      if (processingMode === 'summary') {
        // 文字总结模式的后续步骤
        // 步骤4: 分析章节关联
        setCurrentStep('正在分析章节关联...')
        let connections = cacheService.getString(file.name, 'connections')
        if (!connections) {
          console.log('🔄 [DEBUG] 缓存未命中，开始分析章节关联')
          connections = await aiService.analyzeConnections(processedChapters, processingOptions.outputLanguage, bookType, abortSignal)
          cacheService.setCache(file.name, 'connections', connections)
          console.log('💾 [DEBUG] 章节关联已缓存')
        } else {
          console.log('✅ [DEBUG] 使用缓存的章节关联')
        }

        setBookSummary(prevSummary => ({
          ...prevSummary!,
          connections
        }))
        setProgress(85)

        // 步骤5: 生成全书总结
        setCurrentStep('正在生成全书总结...')
        let overallSummary = cacheService.getString(file.name, 'overall_summary')
        if (!overallSummary) {
          console.log('🔄 [DEBUG] 缓存未命中，开始生成全书总结')
          overallSummary = await aiService.generateOverallSummary(
            bookData.title,
            processedChapters,
            processingOptions.outputLanguage,
            bookType,
            abortSignal
          )
          cacheService.setCache(file.name, 'overall_summary', overallSummary)
          console.log('💾 [DEBUG] 全书总结已缓存')
        } else {
          console.log('✅ [DEBUG] 使用缓存的全书总结')
        }

        setBookSummary(prevSummary => ({
          ...prevSummary!,
          overallSummary
        }))
      } else if (processingMode === 'mindmap') {
        // 章节思维导图模式的后续步骤
        // 步骤4: 合并章节思维导图
        setCurrentStep('正在合并章节思维导图...')
        let combinedMindMap = cacheService.getMindMap(file.name, 'merged_mindmap')
        if (!combinedMindMap) {
          console.log('🔄 [DEBUG] 缓存未命中，开始合并章节思维导图')
          // 创建根节点
          const rootNode = {
            topic: bookData.title,
            id: '0',
            tags: ['全书'],
            children: processedChapters.map((chapter, index) => ({
              topic: chapter.title,
              id: `chapter_${index + 1}`,
              children: chapter.mindMap?.nodeData?.children || []
            }))
          }

          combinedMindMap = {
            nodeData: rootNode,
            arrows: [],
            summaries: processedChapters.reduce((acc, chapter) => acc.concat(chapter.mindMap?.summaries || []), [] as Summary[])
          }

          cacheService.setCache(file.name, 'merged_mindmap', combinedMindMap)
          console.log('💾 [DEBUG] 合并思维导图已缓存')
        } else {
          console.log('✅ [DEBUG] 使用缓存的合并思维导图')
        }

        setProgress(85)

        setBookMindMap(prevMindMap => ({
          ...prevMindMap!,
          combinedMindMap
        }))
      } else if (processingMode === 'combined-mindmap') {
        // 整书思维导图模式的后续步骤
        // 步骤4: 生成整书思维导图
        setCurrentStep('正在生成整书思维导图...')
        let combinedMindMap = cacheService.getMindMap(file.name, 'combined_mindmap')
        if (!combinedMindMap) {
          console.log('🔄 [DEBUG] 缓存未命中，开始生成整书思维导图')
          combinedMindMap = await aiService.generateCombinedMindMap(bookData.title, processedChapters, customPrompt, abortSignal)
          cacheService.setCache(file.name, 'combined_mindmap', combinedMindMap)
          console.log('💾 [DEBUG] 整书思维导图已缓存')
        } else {
          console.log('✅ [DEBUG] 使用缓存的整书思维导图')
        }

        setBookMindMap(prevMindMap => ({
          ...prevMindMap!,
          combinedMindMap
        }))
        setProgress(85)
      }

      setProgress(100)
      setCurrentStep('处理完成！')
    } catch (err) {
      // 如果是AbortError，不显示错误信息
      if (err instanceof Error && err.name === 'AbortError') {
        console.log(t('common.generationCancelled'))
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : t('progress.processingError')
      setError(errorMessage)
      toast.error(errorMessage, {
        duration: 5000,
        position: 'top-center',
      })
    } finally {
      setProcessing(false)
      // 清理AbortController
      if (abortControllerRef.current) {
        abortControllerRef.current = null
      }
    }
  }, [extractedChapters, bookData, apiKey, file, selectedChapters, processingMode, bookType, customPrompt, processingOptions.outputLanguage, t, error])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex justify-center gap-4 h-screen overflow-auto scroll-container">
      <Toaster />
      <div className="max-w-6xl space-y-4 w-[800px] shrink-0">
        <div className="text-center space-y-2 relative">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-2">
            <img src="/icon.png" alt="icon" className="h-12 w-12" />
            {t('app.title')}
          </h1>
          <LanguageSwitcher />
        </div>

        {currentStepIndex === 1 ? (
          <Step1Upload
            file={file}
            processing={processing}
            extractingChapters={extractingChapters}
            extractedChapters={extractedChapters}
            bookData={bookData}
            selectedChapters={selectedChapters}
            customPrompt={customPrompt}
            apiKey={apiKey}
            onFileChange={handleFileChange}
            onExtractChapters={extractChapters}
            onChapterSelect={handleChapterSelect}
            onSelectAll={handleSelectAll}
            onClearBookCache={clearBookCache}
            onSetCurrentReadingChapter={setCurrentReadingChapter}
            onProcessEbook={() => {
              if (!apiKey) {
                toast.error(t('chapters.apiKeyRequired'), {
                  duration: 3000,
                  position: 'top-center',
                })
                return
              }
              processEbook()
            }}
            onCustomPromptChange={setCustomPrompt}
            t={t}
          />
        ) : (
          <Step2Results
            processing={processing}
            extractingChapters={extractingChapters}
            progress={progress}
            currentStep={currentStep}
            error={error}
            bookSummary={bookSummary}
            bookMindMap={bookMindMap}
            bookData={bookData}
            processingMode={processingMode}
            extractedChapters={extractedChapters}
            options={options}
            onBackToConfig={() => { 
              // 取消所有正在进行的请求
              if (abortControllerRef.current) {
                abortControllerRef.current.abort()
                abortControllerRef.current = null
              }
              
              setCurrentStepIndex(1);
              setProcessing(false);
              setExtractingChapters(false);
              setProgress(0);
              setCurrentStep('');
              setError(null);
            }}
            onClearChapterCache={clearChapterCache}
            onClearSpecificCache={clearSpecificCache}
            onDownloadAllMarkdown={downloadAllMarkdown}
            onSetCurrentReadingChapter={setCurrentReadingChapter}
            t={t}
          />
        )}
      </div>

      {/* 阅读组件插入到这里 */}
      {currentReadingChapter && file && (
        file.name.endsWith('.epub') ? (
          <EpubReader
            className="w-[800px] shrink-0 sticky top-0"
            chapter={currentReadingChapter}
            bookData={fullBookData as EpubBookData || undefined}
            onClose={() => setCurrentReadingChapter(null)}
          />
        ) : file.name.endsWith('.pdf') ? (
          <PdfReader
            className="w-[800px] shrink-0 sticky top-0"
            chapter={currentReadingChapter}
            bookData={fullBookData as PdfBookData || undefined}
            onClose={() => setCurrentReadingChapter(null)}
          />
        ) : null
      )}

      {/* 回到顶部按钮 */}
      {showBackToTop && (
        <Button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-300 bg-blue-600 hover:bg-blue-700"
          size="icon"
          aria-label={t('common.backToTop')}
        >
          <ChevronUp className="h-6 w-6" />
        </Button>
      )}
    </div>
  )
}

export default App
