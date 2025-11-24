import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StepDisplay } from './components/StepDisplay';
import { ResultCard } from './components/ResultCard';
import { CodeBlock } from './components/CodeBlock';
import { LogoIcon, RetryIcon, PlayIcon, SpinnerIcon } from './components/icons';
// Legacy imports (will be replaced by dynamic imports in new pipeline)
import * as geminiService from './services/geminiService';
import * as perplexityService from './services/perplexityService';
import { verifyLatex } from './services/latexCompilerService';
import { getFriendlyErrorMessage } from './services/errorService';
import type { ProcessingStep, AnalysisSuccessResult, LatexResult, VerificationResult } from './types';

type AIProvider = 'gemini' | 'perplexity';

const ConfidenceIndicator = ({ score }: { score: number }) => {
  const percentage = Math.round(score * 100);
  const getColor = () => {
    if (score >= 0.9) return { bar: 'bg-green-500', text: 'text-green-400' };
    if (score >= 0.7) return { bar: 'bg-yellow-500', text: 'text-yellow-400' };
    return { bar: 'bg-red-500', text: 'text-red-400' };
  };

  const { bar, text } = getColor();

  return (
    <div className="flex flex-col justify-center h-full">
      <div className="flex justify-between items-center mb-1 font-mono">
        <span className="text-base font-medium text-slate-300">Confidence</span>
        <span className={`text-lg font-bold ${text}`}>{percentage}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-4 border border-slate-600">
        <div className={`${bar} h-full rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }}></div>
      </div>
      <p className="text-xs text-slate-500 mt-2 text-center">
        This score reflects the AI's confidence in its geometric analysis.
      </p>
    </div>
  );
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as a data URL.'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file.'));
    });
};


function App() {
  const [step, setStep] = useState<ProcessingStep>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSuccessResult | null>(null);
  const [latexResult, setLatexResult] = useState<LatexResult | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [aiProvider, setAiProvider] = useState<AIProvider>('perplexity');
  
  // Debug: Store intermediate images
  const [debugImages, setDebugImages] = useState<{
    original: string | null;
    cropped: string | null;
    enhanced: string | null;
  }>({ original: null, cropped: null, enhanced: null });

  const handleFileSelect = useCallback((file: File) => {
    setOriginalFile(file);
    setStep('READY');
    setError(null);
    setAnalysisResult(null);
    setLatexResult(null);
    setCroppedImage(null);
    setDebugImages({ original: null, cropped: null, enhanced: null });
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    if (!originalFile) return;

    setError(null);
    setAnalysisResult(null);
    setLatexResult(null);
    setCroppedImage(null);
    setStep('READY'); 

    try {
        // NEW PIPELINE ARCHITECTURE - DO NOT REORDER THESE STEPS
        
        // Convert file to base64 (original quality, untouched)
        const originalBase64 = await fileToBase64(originalFile);
        const mimeType = originalFile.type || 'image/png';
        
        // Debug: Store original image
        setDebugImages(prev => ({ ...prev, original: originalBase64 }));
        
        // ====================================================================
        // PHASE 1: FR-1 - GEOMETRY REGION DETECTION
        // Send ORIGINAL image to AI for region detection
        // ====================================================================
        setStep('DETECTING');
        console.log('Phase 1: Detecting geometry region in original image...');
        
        const { detectGeometryRegion } = await import('./services/regionDetection');
        const detectionResult = await detectGeometryRegion(originalBase64, mimeType, aiProvider);
        
        console.log(`Detection complete: confidence=${detectionResult.confidence}, method=${detectionResult.detectionMethod}`);
        console.log('Detected bounding box:', JSON.stringify(detectionResult.boundingBox, null, 2));
        
        // Get image dimensions for context
        const imageCropping = await import('./services/imageCropping');
        const originalDims = await imageCropping.getImageDimensions(originalBase64);
        console.log(`Original image dimensions: ${originalDims.width}x${originalDims.height}`);
        
        if (detectionResult.confidence < 0.6) {
            console.warn(`⚠️ Low detection confidence, but continuing anyway...`);
        }
        
        // ====================================================================
        // PHASE 2: FR-2 - LOSSLESS CROPPING
        // Crop to detected region with padding
        // ====================================================================
        setStep('CROPPING');
        console.log('Phase 2: Cropping to detected region...');
        
        const { cropToRegion } = await import('./services/imageCropping');
        const croppedBase64 = await cropToRegion(
            originalBase64, 
            detectionResult.boundingBox, 
            10  // 10px padding
        );
        
        const croppedDims = await imageCropping.getImageDimensions(croppedBase64);
        console.log(`Cropping complete: ${croppedDims.width}x${croppedDims.height}`);
        console.log(`Cropped image size: ${croppedBase64.length} bytes (base64)`);
        
        // Debug: Store cropped image
        setDebugImages(prev => ({ ...prev, cropped: croppedBase64 }));
        
        // Sanity check - cropped image should have reasonable dimensions
        if (croppedDims.width < 50 || croppedDims.height < 50) {
            console.error('⚠️ Cropped image is too small! May indicate detection failure.');
            console.error(`Dimensions: ${croppedDims.width}x${croppedDims.height}`);
        }
        
        // ====================================================================
        // PHASE 3: FR-3 - QUALITY ENHANCEMENT
        // Multi-stage enhancement pipeline
        // ====================================================================
        setStep('ENHANCING');
        console.log('Phase 3: Enhancing image quality...');
        
        const { enhanceImage } = await import('./services/imageEnhancement');
        const enhancementResult = await enhanceImage(croppedBase64);
        
        console.log(`Enhancement complete: filters=${enhancementResult.appliedFilters.join(', ')}`);
        console.log(`  Contrast: ${enhancementResult.metrics.originalContrast.toFixed(2)} → ${enhancementResult.metrics.enhancedContrast.toFixed(2)}`);
        console.log(`  Sharpness: ${enhancementResult.metrics.sharpness.toFixed(2)}`);
        console.log(`  Enhanced image size: ${enhancementResult.enhancedBase64.length} bytes (base64)`);
        
        // Debug: Store enhanced image
        setDebugImages(prev => ({ ...prev, enhanced: enhancementResult.enhancedBase64 }));
        
        // Store enhanced cropped image for display
        setCroppedImage(enhancementResult.enhancedBase64);
        
        // ====================================================================
        // PHASE 4: FR-4 - STRUCTURED GEOMETRY ANALYSIS
        // AI analyzes enhanced image with structured schema
        // ====================================================================
        setStep('ANALYZING');
        console.log('Phase 4: Analyzing geometry structure...');
        
        const { analyzeGeometry } = await import('./services/geometryAnalysis');
        
        // Try with enhanced image first, fallback to cropped if analysis fails
        let geometryResult;
        try {
            console.log('Attempting analysis with enhanced image...');
            geometryResult = await analyzeGeometry(
                enhancementResult.enhancedBase64,
                'image/png',
                aiProvider
            );
        } catch (enhancedError) {
            console.warn('Enhanced image analysis failed, trying with cropped (unenhanced) image...');
            console.warn('Error was:', enhancedError);
            
            // Fallback to cropped but not enhanced image
            geometryResult = await analyzeGeometry(
                croppedBase64,
                'image/png',
                aiProvider
            );
            console.log('✓ Analysis succeeded with cropped (unenhanced) image');
        }
        
        console.log(`Analysis complete: type=${geometryResult.figureType}, confidence=${geometryResult.overallConfidence.toFixed(2)}`);
        console.log(`  Vertices: ${geometryResult.geometryData.vertices?.length || 0}`);
        console.log(`  Edges: ${(geometryResult.geometryData.edges?.length || 0) + (geometryResult.geometryData.lines?.length || 0)}`);
        
        if (geometryResult.overallConfidence < 0.7) {
            console.warn(`Low analysis confidence: ${geometryResult.overallConfidence}. Results may be inaccurate.`);
        }
        
        // Convert to legacy format for display
        const legacyAnalysis = {
            geometryFound: true,
            boundingBox: detectionResult.boundingBox,
            geometryData: geometryResult.geometryData,
            confidenceScore: geometryResult.overallConfidence
        };
        setAnalysisResult(legacyAnalysis as any);
        
        // ====================================================================
        // PHASE 5: FR-5 - TEMPLATE-DRIVEN LATEX GENERATION
        // Generate LaTeX with template + AI refinement
        // ====================================================================
        setStep('GENERATING');
        console.log('Phase 5: Generating LaTeX code...');
        
        const { generateLatex: generateLatexCode } = await import('./services/latexGenerator');
        const latexGenResult = await generateLatexCode(
            geometryResult.geometryData,
            geometryResult.figureType,
            true,  // Use AI refinement
            aiProvider
        );
        
        console.log(`LaTeX generation complete: method=${latexGenResult.generationMethod}`);
        console.log(`  Lines: ${latexGenResult.codeMetrics.lines}`);
        console.log(`  Coordinates: ${latexGenResult.codeMetrics.coordinates}`);
        console.log(`  Edges: ${latexGenResult.codeMetrics.edges}`);
        
        let currentLatexCode = latexGenResult.latexCode;
        
        // ====================================================================
        // VERIFICATION & SELF-CORRECTION LOOP
        // ====================================================================
        let verificationResult: VerificationResult | null = null;
        const MAX_CORRECTION_ATTEMPTS = 2;
        const aiService = aiProvider === 'perplexity' ? perplexityService : geminiService;

        for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
            setStep('VERIFYING');
            console.log(`Verification attempt ${attempt + 1}...`);
            
            try {
                verificationResult = await verifyLatex(currentLatexCode);
                if (verificationResult.success) {
                    console.log('✓ LaTeX code compiled successfully');
                    break;
                }
            } catch (verifyError) {
                console.error("Verification service failed:", verifyError);
                verificationResult = { 
                    success: false, 
                    log: `Verification service error: ${getFriendlyErrorMessage(verifyError)}` 
                };
            }

            if (attempt === MAX_CORRECTION_ATTEMPTS) {
                const finalLog = verificationResult?.log ? `\n\n--- Final Compilation Log ---\n${verificationResult.log}` : '';
                throw new Error(`Failed to produce compilable LaTeX after ${MAX_CORRECTION_ATTEMPTS} correction attempts.${finalLog}`);
            }

            setStep('CORRECTING');
            console.log(`Correcting LaTeX code (attempt ${attempt + 1})...`);
            const correctedResult = await aiService.fixLatex(
                currentLatexCode, 
                verificationResult.log || "Unknown compilation error."
            );
            currentLatexCode = correctedResult.latexCode;
        }
        
        if (!verificationResult?.success) {
             throw new Error("Failed to produce compilable LaTeX code.");
        }
        
        setLatexResult({ latexCode: currentLatexCode });
        setStep('DONE');
        console.log('✓ Pipeline complete!');
        
    } catch (err) {
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        setStep('ERROR');
    }
  }, [originalFile, aiProvider]);

  const isApiProcessing = step === 'ANALYZING' || step === 'GENERATING' || step === 'VERIFYING' || step === 'CORRECTING' || step === 'DETECTING' || step === 'CROPPING' || step === 'ENHANCING';
  const isProcessing = isApiProcessing;
  const showResults = step === 'DONE' && analysisResult && latexResult && croppedImage;

  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans">
      <main className="container mx-auto px-4 py-8 md:py-12">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-3">
            <LogoIcon />
            <h1 className="text-4xl font-bold text-white tracking-tight">GeoLaTeX</h1>
          </div>
          <p className="mt-2 text-lg text-slate-400">
            Upload a geometric diagram, and get its TikZ LaTeX code instantly.
          </p>
          
          {/* AI Provider Selector */}
          <div className="mt-6 flex justify-center gap-4">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="aiProvider"
                value="perplexity"
                checked={aiProvider === 'perplexity'}
                onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                disabled={step !== 'IDLE' && step !== 'READY' && step !== 'DONE' && step !== 'ERROR'}
                className="cursor-pointer"
              />
              <span className="font-medium">Perplexity</span>
            </label>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="aiProvider"
                value="gemini"
                checked={aiProvider === 'gemini'}
                onChange={(e) => setAiProvider(e.target.value as AIProvider)}
                disabled={step !== 'IDLE' && step !== 'READY' && step !== 'DONE' && step !== 'ERROR'}
                className="cursor-pointer"
              />
              <span className="font-medium">Gemini</span>
            </label>
          </div>
        </header>

        <div className="max-w-xl mx-auto mb-8">
          <ImageUploader 
            onImageUpload={handleFileSelect} 
            disabled={isProcessing}
          />
        </div>

        {originalFile && (
           <div className="max-w-4xl mx-auto my-8 flex flex-col items-center gap-4">
             {step !== 'IDLE' && step !== 'READY' && (
               <div className="w-full flex justify-center">
                 <StepDisplay currentStep={step} error={error} />
               </div>
             )}
            
             <button
               onClick={handleStartAnalysis}
               disabled={isProcessing}
               className="flex items-center justify-center gap-3 w-52 h-12 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-all duration-200 disabled:bg-slate-600 disabled:cursor-not-allowed text-lg"
             >
               {isProcessing ? (
                 <>
                   <SpinnerIcon />
                   <span>Processing...</span>
                 </>
               ) : (step === 'DONE' || step === 'ERROR') ? (
                 <>
                   <RetryIcon className="w-5 h-5" />
                   <span>Re-analyze</span>
                 </>
               ) : (
                 <>
                   <PlayIcon className="w-5 h-5" />
                   <span>Analyze Image</span>
                 </>
               )}
             </button>
           </div>
        )}

        {showResults && (
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <ResultCard title="Isolated Geometry">
              <div className="bg-black p-2 rounded-lg border border-slate-700 flex justify-center items-center flex-grow">
                 <img src={`data:image/png;base64,${croppedImage}`} alt="Isolated geometric figure" className="max-w-full max-h-full object-contain rounded-sm" />
              </div>
            </ResultCard>
             <ResultCard title="Analysis Confidence">
               <ConfidenceIndicator score={analysisResult.confidenceScore} />
            </ResultCard>
            <ResultCard title="Geometry Analysis (JSON)">
              <CodeBlock code={JSON.stringify(analysisResult.geometryData, null, 2)} language="json" />
            </ResultCard>
            <ResultCard title="Generated LaTeX (TikZ)">
              <CodeBlock code={latexResult.latexCode} language="latex" />
            </ResultCard>
          </div>
        )}
        
        {/* Debug Panel: Show all intermediate images */}
        {(debugImages.original || debugImages.cropped || debugImages.enhanced) && (
          <div className="mt-12 border-t border-slate-700 pt-8">
            <h2 className="text-2xl font-bold text-white mb-6">🔍 Debug: Intermediate Images</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {debugImages.original && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">1. Original Image</h3>
                  <img 
                    src={`data:image/png;base64,${debugImages.original}`} 
                    alt="Original" 
                    className="w-full border border-slate-600 rounded"
                  />
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `data:image/png;base64,${debugImages.original}`;
                      link.download = 'debug-original.png';
                      link.click();
                    }}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                  >
                    Download Original
                  </button>
                </div>
              )}
              {debugImages.cropped && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">2. Cropped Image</h3>
                  <img 
                    src={`data:image/png;base64,${debugImages.cropped}`} 
                    alt="Cropped" 
                    className="w-full border border-slate-600 rounded"
                  />
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `data:image/png;base64,${debugImages.cropped}`;
                      link.download = 'debug-cropped.png';
                      link.click();
                    }}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                  >
                    Download Cropped
                  </button>
                </div>
              )}
              {debugImages.enhanced && (
                <div className="bg-slate-800 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-white mb-3">3. Enhanced Image</h3>
                  <img 
                    src={`data:image/png;base64,${debugImages.enhanced}`} 
                    alt="Enhanced" 
                    className="w-full border border-slate-600 rounded"
                  />
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = `data:image/png;base64,${debugImages.enhanced}`;
                      link.download = 'debug-enhanced.png';
                      link.click();
                    }}
                    className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm"
                  >
                    Download Enhanced
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </main>
      <footer className="text-center p-4 text-slate-500 text-sm">
        <p>Powered by Perplexity AI</p>
      </footer>
    </div>
  );
}

export default App;
