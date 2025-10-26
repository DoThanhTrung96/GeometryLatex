import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StepDisplay } from './components/StepDisplay';
import { ResultCard } from './components/ResultCard';
import { CodeBlock } from './components/CodeBlock';
import { LogoIcon, RetryIcon, PlayIcon, SpinnerIcon } from './components/icons';
import { preprocessImage, cropImage, getValidatedBoundingBox } from './services/imageProcessing';
import { analyzeGeometry, generateLatex, fixLatex } from './services/geminiService';
import { verifyLatex } from './services/latexCompilerService';
import { getFriendlyErrorMessage } from './services/errorService';
import type { ProcessingStep, AnalysisSuccessResult, LatexResult, VerificationResult } from './types';

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
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSuccessResult | null>(null);
  const [latexResult, setLatexResult] = useState<LatexResult | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);

  const handleFileSelect = useCallback((file: File) => {
    setOriginalFile(file);
    setStep('READY');
    setError(null);
    setAnalysisResult(null);
    setLatexResult(null);
    setCroppedImage(null);
  }, []);

  const handleStartAnalysis = useCallback(async () => {
    if (!originalFile) return;

    setError(null);
    setAnalysisResult(null);
    setLatexResult(null);
    setCroppedImage(null);
    setIsPreprocessing(true);
    setStep('READY'); 

    try {
        const base64 = await fileToBase64(originalFile);
        const preprocessedBase64 = await preprocessImage(base64);
        setIsPreprocessing(false);

        setStep('ANALYZING');
        const analysis = await analyzeGeometry(preprocessedBase64, 'image/png');
        
        if (!analysis.geometryFound) {
            throw new Error("No geometric figure could be identified in the image. Please try a clearer image.");
        }
        
        setAnalysisResult(analysis);

        const validatedBox = await getValidatedBoundingBox(preprocessedBase64, analysis.boundingBox);
        const cropped = await cropImage(preprocessedBase64, validatedBox);
        setCroppedImage(cropped);

        if (analysis.confidenceScore < 0.7) {
            console.warn(`Low confidence score: ${analysis.confidenceScore}. Results may be inaccurate.`);
        }

        // --- Start of Verification and Correction Loop ---
        let currentLatexCode = '';
        let verificationResult: VerificationResult | null = null;
        const MAX_CORRECTION_ATTEMPTS = 2;

        setStep('GENERATING');
        const initialResult = await generateLatex(analysis.geometryData);
        currentLatexCode = initialResult.latexCode;

        for (let attempt = 0; attempt <= MAX_CORRECTION_ATTEMPTS; attempt++) {
            setStep('VERIFYING');
            try {
                verificationResult = await verifyLatex(currentLatexCode);
                if (verificationResult.success) {
                    break; // Exit loop if compilation is successful
                }
            } catch (verifyError) {
                console.error("Verification service failed:", verifyError);
                verificationResult = { success: false, log: `The LaTeX verification service could not be reached. Error: ${getFriendlyErrorMessage(verifyError)}` };
            }

            if (attempt === MAX_CORRECTION_ATTEMPTS) {
                const finalLog = verificationResult?.log ? `\n\n--- Final Compilation Log ---\n${verificationResult.log}` : '';
                throw new Error(`The AI failed to produce compilable LaTeX code after ${MAX_CORRECTION_ATTEMPTS} attempts.${finalLog}`);
            }

            setStep('CORRECTING');
            const correctedResult = await fixLatex(currentLatexCode, verificationResult.log || "Unknown compilation error.");
            currentLatexCode = correctedResult.latexCode;
        }
        
        if (!verificationResult?.success) {
             throw new Error("Failed to produce compilable LaTeX code after multiple correction attempts.");
        }
        
        setLatexResult({ latexCode: currentLatexCode });
        setStep('DONE');
    } catch (err) {
        setIsPreprocessing(false);
        const friendlyMessage = getFriendlyErrorMessage(err);
        setError(friendlyMessage);
        setStep('ERROR');
    }
  }, [originalFile]);

  const isApiProcessing = step === 'ANALYZING' || step === 'GENERATING' || step === 'VERIFYING' || step === 'CORRECTING';
  const isProcessing = isApiProcessing || isPreprocessing;
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
        </header>

        <div className="max-w-xl mx-auto mb-8">
          <ImageUploader 
            onImageUpload={handleFileSelect} 
            disabled={isProcessing}
            isProcessing={isPreprocessing}
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

      </main>
      <footer className="text-center p-4 text-slate-500 text-sm">
        <p>Powered by Gemini API</p>
      </footer>
    </div>
  );
}

export default App;
