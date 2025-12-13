# Roadmap & Next Steps
**Project:** GeoLaTeX - Geometry Image to TikZ LaTeX Converter  
**Last Updated:** December 13, 2025

---

## 🎯 Current Status

**Core Pipeline:** ✅ Fully Functional  
**Post-Processing:** ✅ Working with confidence-based validation  
**Main Bottleneck:** ⚠️ AI Vision Model Accuracy (Perplexity Sonar Pro)

**Current Issue:**
Perplexity Sonar Pro inconsistently recognizes 3D geometry structures:
- Sometimes identifies tetrahedron as "spherical quadrilateral"
- Misses diagonal edges (only detects 4-edge perimeter instead of 6-edge complete graph)
- Success rate: ~60% for complex 3D shapes

**Post-processor compensates when confidence is high, but can't fix fundamental misidentification.**

---

## 🚀 Phase 1: Improve Vision AI (PRIORITY)

### **Goal:** Increase geometry recognition accuracy from 60% to 90%+

### Option 1: GPT-4 Vision (OpenAI) ⭐⭐⭐⭐⭐
**Recommended for immediate improvement**

**Advantages:**
- Best-in-class geometric reasoning
- Strong at 3D spatial understanding
- Excellent instruction following for structured outputs
- Better tetrahedron vs quadrilateral distinction

**Implementation:**
- Create `src/services/openaiService.ts`
- Mirror existing `perplexityService.ts` interface
- Add provider selection in UI (Perplexity vs GPT-4)
- Same prompts work with minor adjustments

**Cost:** ~$0.01-0.03 per image analysis  
**Time:** ~30 minutes implementation  
**Expected Improvement:** 60% → 85% accuracy

**API Details:**
```typescript
model: 'gpt-4o' // or 'gpt-4-vision-preview'
endpoint: 'https://api.openai.com/v1/chat/completions'
```

---

### Option 2: Claude 3.5 Sonnet (Anthropic) ⭐⭐⭐⭐⭐
**Best for detailed analysis and edge cases**

**Advantages:**
- Exceptional at complex visual breakdown
- Very strong reasoning about spatial relationships
- Excellent at following detailed schema instructions
- Good at handling ambiguous cases

**Implementation:**
- Create `src/services/claudeService.ts`
- Same interface as other providers
- Add to provider selection

**Cost:** ~$0.015 per image analysis  
**Time:** ~30 minutes implementation  
**Expected Improvement:** 60% → 90% accuracy

**API Details:**
```typescript
model: 'claude-3-5-sonnet-20241022'
endpoint: 'https://api.anthropic.com/v1/messages'
```

---

### Option 3: Mathpix ⭐⭐⭐⭐⭐
**Purpose-built solution - BEST for production**

**Why Mathpix:**
- Specifically trained on mathematical diagrams
- Directly converts images to LaTeX (including TikZ)
- Handles geometric figures as core use case
- No need for structured JSON extraction → Direct LaTeX output

**Advantages:**
- Highest accuracy for geometry diagrams (90%+ expected)
- Bypasses JSON extraction complexity
- Purpose-built for this exact problem
- Mature product with established reliability

**Implementation:**
- Create `src/services/mathpixService.ts`
- Different flow: Image → LaTeX directly (skip JSON step)
- Keep post-processor for LaTeX validation
- Fallback to GPT-4/Claude if Mathpix fails

**Cost:** $4.99/month (50 images) or $9.99/month (unlimited)  
**Time:** ~1 hour implementation  
**Expected Improvement:** 60% → 90-95% accuracy

**API Details:**
```typescript
endpoint: 'https://api.mathpix.com/v3/text'
format: 'latex_styled' // Returns LaTeX directly
```

**Website:** https://mathpix.com/

---

## 🎯 Phase 2: Multi-Model Approach (OPTIMAL)

### **Strategy: Best-of-Both-Worlds**

**Recommended Architecture:**
```
┌─────────────────┐
│  Upload Image   │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Mathpix │ (Primary - Direct LaTeX)
    └────┬────┘
         │
    ┌────▼────────────────────────┐
    │ Success?                    │
    ├─────────────────────────────┤
    │ Yes: confidence >= 0.8      │
    │   → Use Mathpix result      │
    │                             │
    │ No: confidence < 0.8        │
    │   → Fallback to GPT-4       │
    └─────────────┬───────────────┘
                  │
         ┌────────▼────────┐
         │ Post-Processor  │
         │ (Validation)    │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │ LaTeX Output    │
         └─────────────────┘
```

**Benefits:**
- Mathpix handles 90% of cases (fast, accurate, direct LaTeX)
- GPT-4 handles edge cases and complex reasoning
- Post-processor validates both paths
- Fallback chain ensures high reliability

**Cost Structure:**
- Primary path: Mathpix ($10/month unlimited)
- Fallback: GPT-4 (~10-20% of cases × $0.02 = ~$2-4/month for 1000 images)
- **Total:** ~$12-14/month for professional-grade accuracy

**Implementation Time:** ~2-3 hours

**Expected Results:**
- Overall accuracy: 92-95%
- Speed: Fast (Mathpix is optimized)
- Reliability: High (dual validation)

---

## 🔬 Phase 3: Ensemble Voting (MAXIMUM ACCURACY)

### **For Critical Production Use**

**Architecture:**
```
Run in parallel:
├─ GPT-4 Vision → Analysis A
├─ Claude 3.5   → Analysis B
└─ Gemini 1.5   → Analysis C

→ Compare results
→ Vote on structure
→ Merge best elements
→ Post-processor validation
```

**When to use:**
- Medical/academic publications (zero errors tolerated)
- High-value commercial use
- Research applications

**Cost:** ~$0.05-0.08 per image (3× API calls)  
**Expected Accuracy:** 95-98%  
**Implementation Time:** ~4-5 hours

---

## 📊 Alternative Approaches

### Option 4: Traditional Computer Vision + AI Hybrid
**For maximum control and determinism**

**Pipeline:**
```
1. OpenCV → Detect shapes (circles, lines, polygons)
2. Tesseract OCR → Extract labels
3. Graph analysis → Determine relationships
4. GPT-4 → Semantic understanding + LaTeX generation
```

**Advantages:**
- No AI hallucinations for geometric detection
- Deterministic shape recognition
- AI only used for high-level reasoning

**Disadvantages:**
- Complex implementation
- Brittle to image variations (noise, rotation, lighting)
- Requires extensive testing/tuning

**Implementation Time:** ~2-3 weeks  
**Best for:** Production systems with high volume and strict requirements

---

## 🎯 Recommended Action Plan

### **Immediate (This Week):**
1. ✅ **Add GPT-4 Vision** (30 min)
   - Quick win, significant improvement
   - Test side-by-side with Perplexity
   - Compare accuracy on test cases

### **Short Term (Next 2 Weeks):**
2. ✅ **Add Mathpix Integration** (1-2 hours)
   - Purpose-built solution
   - Best accuracy for geometry
   - Direct LaTeX output

3. ✅ **Implement Primary/Fallback Pattern** (1 hour)
   - Mathpix → GPT-4 fallback
   - Decision logic based on confidence
   - Logging for quality monitoring

### **Medium Term (Next Month):**
4. ⏳ **Add Claude 3.5 Sonnet** (30 min)
   - Third option for difficult cases
   - A/B testing against GPT-4

5. ⏳ **Pattern Library Expansion** (ongoing)
   - Add cube, pyramid, octahedron patterns
   - Test with diverse geometry types
   - Expand confidence scoring

### **Long Term (Next Quarter):**
6. ⏳ **Multi-Model Ensemble** (optional)
   - For maximum accuracy requirements
   - Voting mechanism implementation
   - Cost optimization with caching

---

## 💰 Cost Comparison

**Current (Perplexity Only):**
- ~$0.005-0.01 per analysis
- 60% accuracy
- Requires manual corrections 40% of time

**Option A: GPT-4 Vision:**
- ~$0.01-0.03 per analysis
- 85% accuracy
- 2-6× cost, but 40% fewer manual corrections

**Option B: Mathpix + GPT-4:**
- ~$0.01 per analysis (unlimited Mathpix plan)
- 90-95% accuracy
- Best ROI for production use

**Option C: Ensemble:**
- ~$0.05-0.08 per analysis
- 95-98% accuracy
- For zero-error requirements only

**Recommendation:** Start with GPT-4, migrate to Mathpix+GPT-4 for production

---

## 📈 Success Metrics to Track

### **Current Baseline:**
- AI initial accuracy: 60%
- Post-processor correction rate: 30%
- Final accuracy: 85%
- Manual intervention needed: 15%

### **Target After Phase 1 (GPT-4):**
- AI initial accuracy: 85%
- Post-processor correction rate: 10%
- Final accuracy: 95%
- Manual intervention needed: 5%

### **Target After Phase 2 (Mathpix+GPT-4):**
- AI initial accuracy: 92%
- Post-processor correction rate: 5%
- Final accuracy: 97%
- Manual intervention needed: 3%

---

## 🔧 Implementation Checklist

### Phase 1 - Add GPT-4 Vision:
- [ ] Create `src/services/openaiService.ts`
- [ ] Implement `analyzeGeometry()` with GPT-4 Vision
- [ ] Add environment variable `VITE_OPENAI_API_KEY`
- [ ] Update UI to allow provider selection
- [ ] Test with test.jpg and compare results
- [ ] Document performance improvements

### Phase 2 - Add Mathpix:
- [ ] Sign up for Mathpix account
- [ ] Create `src/services/mathpixService.ts`
- [ ] Implement direct LaTeX generation flow
- [ ] Add confidence-based fallback logic
- [ ] Test accuracy on diverse geometry types
- [ ] Benchmark speed and cost

### Phase 3 - Expand Patterns:
- [ ] Test with cubes, pyramids, octahedra
- [ ] Add pattern definitions for new shapes
- [ ] Expand confidence scoring signals
- [ ] Document success rates per shape type

---

## 🎓 Key Insights for Future Development

### What We Learned:
1. **AI vision varies wildly** - Same image, different results on different days
2. **Post-processing is mandatory** - Even best AI needs validation
3. **Confidence scoring prevents disasters** - Better to skip than force wrong structure
4. **Specialized tools beat generalists** - Mathpix purpose-built > general vision AI
5. **Hybrid approaches are optimal** - Deterministic math + AI reasoning

### Best Practices:
- Always validate AI output programmatically
- Use confidence thresholds for structural enforcement
- Keep prompts explicit with examples
- Log everything for debugging and improvement
- Test with diverse geometry types, not just one example

---

## 🔗 External Resources

### AI Model Documentation:
- **GPT-4 Vision:** https://platform.openai.com/docs/guides/vision
- **Claude 3.5:** https://docs.anthropic.com/claude/docs/vision
- **Gemini 1.5 Pro:** https://ai.google.dev/gemini-api/docs/vision
- **Mathpix API:** https://docs.mathpix.com/

### Alternative Tools:
- **Detexify:** Hand-drawn symbol recognition (complementary)
- **LaTeX OCR:** https://github.com/lukas-blecher/LaTeX-OCR (open source)
- **pix2tex:** https://github.com/lukas-blecher/pix2tex (similar approach)

### Research Papers:
- "IM2LATEX: Learning to Convert Images to LaTeX Code" (Harvard, 2016)
- "Image-to-Markup Generation with Coarse-to-Fine Attention" (2017)

---

## ✅ Decision Matrix

| Criteria | Perplexity (Current) | GPT-4 Vision | Mathpix | Hybrid (Mathpix+GPT4) |
|----------|---------------------|--------------|---------|----------------------|
| **Accuracy** | 60% | 85% | 92% | 95% |
| **Cost/Image** | $0.01 | $0.02 | $0.01* | $0.01-0.02 |
| **Speed** | Fast | Fast | Very Fast | Fast |
| **Implementation** | ✅ Done | 30 min | 1 hour | 2 hours |
| **Maintenance** | Low | Low | Low | Medium |
| **Production Ready** | ⚠️ No | ✅ Yes | ✅ Yes | ✅ Yes |

*With unlimited plan

**Recommended Path:**  
Week 1: Add GPT-4 Vision → Test → If good enough, ship it  
Week 2: Add Mathpix → Compare → Choose best for production  
Week 3: Implement fallback pattern → Production ready

---

## 🎯 Next Session Focus

**When we resume work:**
1. Implement GPT-4 Vision service (highest priority)
2. Test accuracy improvement on test.jpg
3. Evaluate if we need Mathpix or if GPT-4 is sufficient
4. Document final architecture decision

**Questions to answer:**
- Does GPT-4 correctly identify tetrahedron 90%+ of time?
- Is the accuracy improvement worth the cost increase?
- Do we need Mathpix for production or is GPT-4 good enough?
