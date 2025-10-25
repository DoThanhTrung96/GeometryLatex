import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StepDisplay } from './components/StepDisplay';
import { ResultCard } from './components/ResultCard';
import { CodeBlock } from './components/CodeBlock';
import { LogoIcon } from './components/icons';
import { preprocessImage, cropImage } from './services/imageProcessing';
import { analyzeGeometry, generateLatex } from './services/geminiService';
import type { ProcessingStep, AnalysisSuccessResult, LatexResult } from './types';

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


function App() {
  const [step, setStep] = useState<ProcessingStep>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [isPreprocessing, setIsPreprocessing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSuccessResult | null>(null);
  const [latexResult, setLatexResult] = useState<LatexResult | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);

  const handleImageUpload = useCallback(async (file: File) => {
    setStep('READY');
    setError(null);
    setAnalysisResult(null);
    setLatexResult(null);
    setCroppedImage(null);
    setIsPreprocessing(true);

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

    try {
        const base64 = await fileToBase64(file);
        const preprocessedBase64 = await preprocessImage(base64);
        setIsPreprocessing(false);

        setStep('ANALYZING');
        const analysis = await analyzeGeometry(preprocessedBase64, 'image/png');
        
        if (!analysis.geometryFound) {
            throw new Error("No geometric figure could be identified in the image. Please try a clearer image.");
        }
        
        // From here, `analysis` is guaranteed to be AnalysisSuccessResult
        setAnalysisResult(analysis);

        const cropped = await cropImage(preprocessedBase64, analysis.boundingBox);
        setCroppedImage(cropped);

        if (analysis.confidenceScore < 0.7) {
            console.warn(`Low confidence score: ${analysis.confidenceScore}. Results may be inaccurate.`);
        }

        setStep('VERIFYING');
        const latex = await generateLatex(analysis.geometryData);

        if (typeof latex !== 'object' || latex === null || typeof latex.latexCode !== 'string') {
            throw new Error("Invalid LaTeX result from AI. Expected a valid object with latexCode.");
        }
        setLatexResult(latex);

        setStep('DONE');
    } catch (err) {
        console.error("Processing failed:", err);
        setIsPreprocessing(false);
        
        let errorMessage = 'An unknown error occurred during processing.';
        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (typeof err === 'object' && err !== null) {
            errorMessage = ('message' in err && typeof (err as any).message === 'string')
                ? (err as any).message
                : JSON.stringify(err, null, 2);
        } else if (err) {
            errorMessage = String(err);
        }
    
        setError(errorMessage);
        setStep('ERROR');
    }
  }, []);

  const isApiProcessing = step === 'ANALYZING' || step === 'VERIFYING';
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
            onImageUpload={handleImageUpload} 
            disabled={isApiProcessing || isPreprocessing}
            isProcessing={isPreprocessing}
          />
        </div>

        {step !== 'IDLE' && step !== 'READY' && (
          <div className="max-w-2xl mx-auto mb-8">
            <StepDisplay currentStep={step} error={error} />
          </div>
        )}

        {showResults && (
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            <ResultCard title="Isolated Geometry">
              <div className="bg-black p-2 rounded-lg border border-slate-700 flex justify-center items-center">
                 <img src={`data:image/png;base64,${croppedImage}`} alt="Isolated geometric figure" className="max-w-full h-auto rounded-sm" />
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