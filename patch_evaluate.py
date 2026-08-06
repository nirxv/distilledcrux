import os

path = "src/pages/Evaluate.tsx"

with open(path, "r") as f:
    src = f.read()

# ── 2. Add new state variables ────────────────────────────────────────────────
old_states = """  const timerRef                      = useRef(null)"""
new_states = """  const [extractingQ, setExtractingQ] = useState(false)
  const [transcript, setTranscript]   = useState('')
  const [ocrLoading, setOcrLoading]   = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)
  const inputRef                      = useRef(null)
  const timerRef                      = useRef(null)"""
assert old_states in src, "state vars anchor not found"
src = src.replace(old_states, new_states, 1)

# ── 3. Replace addFiles ──────────────────────────────────────────────────────
old_add = """  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f =>
      (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size  [...prev, ...valid].slice(0, 10))
    valid.forEach(f => {
      if (f.type === 'application/pdf') {
        // Show a PDF placeholder preview
        setPreviews(prev => [...prev, '__pdf__'].slice(0, 10))
      } else {
        const reader = new FileReader()
        reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string].slice(0, 10))
        reader.readAsDataURL(f)
      }
    })
    // Auto-extract question from first image
    const firstImage = valid.find(f => f.type.startsWith('image/'))
    if (firstImage) {
      setExtractingQ(true)
      extractQuestion(firstImage).then(q => {
        if (q) setQuestion(q)
        setExtractingQ(false)
      }).catch(() => setExtractingQ(false))
    }
  }, []) // eslint-disable-line"""
new_add = """  const addFiles = useCallback((newFiles: File[]) => {
    const valid = newFiles.filter(f =>
      (f.type.startsWith('image/') || f.type === 'application/pdf') && f.size  [...prev, ...valid].slice(0, 10))
    valid.forEach(f => {
      if (f.type === 'application/pdf') {
        setPreviews(prev => [...prev, '__pdf__'].slice(0, 10))
      } else {
        const reader = new FileReader()
        reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string].slice(0, 10))
        reader.readAsDataURL(f)
      }
    })

    // Run extract-question + OCR in parallel
    const firstImage = valid.find(f => f.type.startsWith('image/'))
    const imageFiles = valid.filter(f => f.type.startsWith('image/'))

    setOcrLoading(true)
    setShowTranscript(false)
    setTranscript('')

    const questionP = firstImage
      ? (setExtractingQ(true), extractQuestion(firstImage)
          .then(q => { if (q) setQuestion(q) })
          .catch(() => {})
          .finally(() => setExtractingQ(false)))
      : Promise.resolve()

    const ocrP = imageFiles.length > 0
      ? (async () => {
          try {
            const fd = new FormData()
            imageFiles.forEach(f => fd.append('files', f))
            // /api/ocr requires auth token — get it if user is logged in
            const headers: Record = {}
            if (auth.currentUser) {
              const tok = await auth.currentUser.getIdToken()
              headers['x-user-token'] = tok
            }
            const res = await fetch('/api/ocr', { method: 'POST', headers, body: fd })
            if (res.ok) {
              const data = await res.json()
              setTranscript(data.text ?? '')
            }
          } catch { /* non-fatal */ }
        })()
      : Promise.resolve()

    Promise.all([questionP, ocrP]).finally(() => {
      setOcrLoading(false)
      setShowTranscript(true)
    })
  }, []) // eslint-disable-line"""
assert old_add in src, "addFiles anchor not found"
src = src.replace(old_add, new_add, 1)

# ── 4. Update removeFile ─────────────────────────────────────────────────────
old_remove = """  const removeFile = (i: number) => {
    setFiles(prev => prev.filter((_,idx) => idx !== i))
    setPreviews(prev => prev.filter((_,idx) => idx !== i))
  }"""
new_remove = """  const removeFile = (i: number) => {
    setFiles(prev => {
      const next = prev.filter((_,idx) => idx !== i)
      if (next.length === 0) { setShowTranscript(false); setTranscript('') }
      return next
    })
    setPreviews(prev => prev.filter((_,idx) => idx !== i))
  }"""
assert old_remove in src, "removeFile anchor not found"
src = src.replace(old_remove, new_remove, 1)

# ── 5. Update handleSubmit ──────────────────────────────────────────────────
old_submit_fd = """      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      fd.append('question', question.trim())
      fd.append('marks', marks)
      fd.append('subject', subjectId)
      fd.append('lang', 'en')"""
new_submit_fd = """      const fd = new FormData()
      files.forEach(f => fd.append('files', f))
      fd.append('question', question.trim())
      fd.append('marks', marks)
      fd.append('subject', subjectId)
      fd.append('lang', 'en')
      if (transcript.trim()) fd.append('extractedText', transcript.trim())"""
assert old_submit_fd in src, "handleSubmit fd anchor not found"
src = src.replace(old_submit_fd, new_submit_fd, 1)

# ── 6. Update reset ─────────────────────────────────────────────────────────
old_reset = """  const reset = () => {
    setResult(null); setFiles([]); setPreviews([]); setQuestion(''); setError(null); setLimitReached(false)
  }"""
new_reset = """  const reset = () => {
    setResult(null); setFiles([]); setPreviews([]); setQuestion('')
    setError(null); setLimitReached(false); setTranscript(''); setShowTranscript(false)
  }"""
assert old_reset in src, "reset anchor not found"
src = src.replace(old_reset, new_reset, 1)

# ── 7. Replace the Form section ─────────────────────────────────────────────
old_form = """        {/* Form */}
        {!loading && !result && !limitReached && (
          
            
              Answer images

               { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
              >
                
                  
                    
                  
                
                Drop images here or click to browse
                JPG, PNG, WEBP or PDF — max 20MB, up to 10 pages
                 { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
              

              {previews.length > 0 && (
                
                  {previews.map((src, i) => (
                    
                      {src === '__pdf__'
                ? 
                    
                    PDF
                  
                : 
              }
                       removeFile(i)}>×
                    
                  ))}
                
              )}

              
                
                  
                    
                    
                  
                  {extractingQ
                    ? Reading question from your answer sheet…
                    : files.length > 0
                      ? Question auto-extracted — review before submitting.
                      : Question will be auto-extracted from your answer sheet.
                  }
                
              

              
                Marks
                
                  {MARKS_OPTIONS.map(m => (
                     setMarks(m)}>
                      {m}M
                    
                  ))}
                
              

              {error && {error}}

              
                
                  {profileLoading ? 'Loading…' : extractingQ ? 'Reading question…' : 'Evaluate answer →'}
                
              
            

            
              
                How it works
                {[
                  { n:'01', title:'Upload images', sub:'Photograph your handwritten answer — up to 10 pages.' },
                  { n:'02', title:'Add question + marks', sub:'Paste the exact question and select 10M / 15M / 20M.' },
                  { n:'03', title:'Get evaluated', sub:'Marks, section feedback, thinkers to cite, and a model answer.' },
                ].map(s => (
                  
                    {s.n}
                    {s.title}{s.sub}
                  
                ))}
              

              
                Tips
                
                  Images or PDF. Upload JPG/PNG photos of your answer sheet, or a scanned PDF — up to 10 pages.
                  Good lighting matters. Shoot in daylight, avoid shadows. Blurry images reduce accuracy.
                  Question auto-fills. We try to read the question from your sheet — check and edit if needed.
                
              

              {!profileLoading && subjectLabel && (
                
                  Your optional
                  
                    Evaluation is calibrated for {subjectLabel} — thinker roster, rubric weights, and model answers are all subject-specific.
                  
                
              )}
            
          
        )}"""

new_form = """        {/* Upload form */}
        {!loading && !result && !limitReached && !showTranscript && (
          
            
              Answer images

               { e.preventDefault(); setDrag(true) }}
                onDragLeave={() => setDrag(false)}
                onDrop={onDrop}
              >
                
                  
                    
                  
                
                Drop images here or click to browse
                JPG, PNG, WEBP or PDF — max 20MB, up to 10 pages
                 { addFiles(Array.from(e.target.files ?? [])); e.target.value = '' }} />
              

              {previews.length > 0 && (
                
                  {previews.map((src, i) => (
                    
                      {src === '__pdf__'
                ? 
                    
                    PDF
                  
                : 
              }
                       removeFile(i)}>×
                    
                  ))}
                
              )}

              {/* OCR reading indicator */}
              {ocrLoading && (
                
                  
                  Reading handwriting… this takes a few seconds
                
              )}

              {error && {error}}
            

            
              
                How it works
                {[
                  { n:'01', title:'Upload images', sub:'Photograph your handwritten answer — up to 10 pages.' },
                  { n:'02', title:'Review transcript', sub:'We OCR your answer — check and fix any misreads before submitting.' },
                  { n:'03', title:'Get evaluated', sub:'Marks, section feedback, thinkers to cite, and a model answer.' },
                ].map(s => (
                  
                    {s.n}
                    {s.title}{s.sub}
                  
                ))}
              

              
                Tips
                
                  Images or PDF. Upload JPG/PNG photos of your answer sheet, or a scanned PDF — up to 10 pages.
                  Good lighting matters. Shoot in daylight, avoid shadows. Blurry images reduce accuracy.
                  Review before submitting. After upload, you&apos;ll see the OCR transcript — fix any thinker names or dates before we evaluate.
                
              

              {!profileLoading && subjectLabel && (
                
                  Your optional
                  
                    Evaluation is calibrated for {subjectLabel} — thinker roster, rubric weights, and model answers are all subject-specific.
                  
                
              )}
            
          
        )}

        {/* Transcript review screen */}
        {!loading && !result && !limitReached && showTranscript && (
          
            
              Review before submitting

              
                Check carefully before submitting. OCR can misread thinker names, dates, and technical terms.
                Fix any errors below — this is what the AI will evaluate.
              

              
                
                  Question
                  {extractingQ && reading…}
                
                 setQuestion(e.target.value)}
                  placeholder="Question will appear here — edit if needed"
                  rows={3}
                />
              

              
                Answer transcript — edit any OCR errors
                 setTranscript(e.target.value)}
                  placeholder="OCR transcript will appear here…"
                />
              

              
                Marks
                
                  {MARKS_OPTIONS.map(m => (
                     setMarks(m)}>
                      {m}M
                    
                  ))}
                
              

              {error && {error}}

              
                 { setShowTranscript(false); setTranscript(''); setFiles([]); setPreviews([]) }}
                >
                  ← Re-upload
                
                
                  {profileLoading ? 'Loading…' : 'Looks good — evaluate →'}
                
              
            

            
              
                What to check
                {[
                  { n:'01', title:'Thinker names', sub:'OCR often misreads scholar names — check every name carefully.' },
                  { n:'02', title:'Dates and years', sub:'Numbers can get transposed — verify all dates in the transcript.' },
                  { n:'03', title:'Technical terms', sub:'Subject-specific vocabulary may be garbled — fix before evaluating.' },
                ].map(s => (
                  
                    {s.n}
                    {s.title}{s.sub}
                  
                ))}
              

              {previews.length > 0 && (
                
                  Your pages ({previews.length})
                  
                    {previews.map((src, i) => (
                      
                        {src === '__pdf__'
                          ? PDF
                          : 
                        }
                      
                    ))}
                  
                
              )}

              {!profileLoading && subjectLabel && (
                
                  Your optional
                  
                    Evaluation is calibrated for {subjectLabel}.
                  
                
              )}
            
          
        )}"""

assert old_form in src, "form section anchor not found"
src = src.replace(old_form, new_form, 1)

with open(path, "w") as f:
    f.write(src)

print("All patches applied successfully")
