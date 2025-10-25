
import React, { useState, useCallback } from 'react';
import { analyzeGeometry, generateLatex } from './services/geminiService';
import { preprocessImage } from './services/imageProcessing';
import type { AnalysisResult, GeometryData, ProcessingStep } from './types';
import { ImageUploader } from './components/ImageUploader';
import { StepDisplay } from './components/StepDisplay';
import { ResultCard } from './components/ResultCard';
import { CodeBlock } from './components/CodeBlock';
import { LogoIcon, UploadIcon } from './components/icons';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isPreprocessing, setIsPreprocessing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [latexCode, setLatexCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<ProcessingStep>('IDLE');

  const resetState = () => {
    setImage(null);
    setProcessedImage(null);
    setAnalysisResult(null);
    setLatexCode(null);
    setError(null);
    setCurrentStep('IDLE');
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
  };

  const handleImageUpload = async (file: File) => {
    resetState();
    setIsPreprocessing(true);
    
    try {
        const base64String = await fileToBase64(file);
        setImage(base64String); // For original preview

        const processed = await preprocessImage(base64String);
        setProcessedImage(processed);

        setCurrentStep('READY');
    } catch (err) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to load or preprocess image: ${errorMessage}`);
        setCurrentStep('ERROR');
    } finally {
        setIsPreprocessing(false);
    }
  };

  const processGeometry = useCallback(async () => {
    if (!processedImage) {
      setError('Please upload an image first. The preprocessed image is missing.');
      return;
    }

    setCurrentStep('ANALYZING');
    setError(null);
    setAnalysisResult(null);
    setLatexCode(null);

    try {
      const analysis: AnalysisResult = await analyzeGeometry(processedImage, 'image/png');
      setAnalysisResult(analysis);
      setCurrentStep('VERIFYING');

      const latexResult = await generateLatex(analysis.geometryData);
      setLatexCode(latexResult.latexCode);
      setCurrentStep('DONE');
      
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Processing failed: ${errorMessage}`);
      setCurrentStep('ERROR');
    }
  }, [processedImage]);

  const renderResults = () => {
    if (currentStep === 'IDLE' || currentStep === 'READY') return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {analysisResult?.isolatedGeometrySVG && (
          <ResultCard title="1. Isolated Geometry">
            <div className="bg-white rounded-lg p-4 flex justify-center items-center">
              <img 
                src={`data:image/svg+xml;base64,${btoa(analysisResult.isolatedGeometrySVG)}`} 
                alt="Isolated Geometry" 
                className="max-w-full h-auto"
              />
            </div>
          </ResultCard>
        )}
        {analysisResult?.geometryData && (
          <ResultCard title="2. Extracted Data & Line Types">
            <CodeBlock language="json" code={JSON.stringify(analysisResult.geometryData, null, 2)} />
          </ResultCard>
        )}
        {latexCode && (
           <ResultCard title="3. Generated LaTeX (TikZ)">
             <CodeBlock language="latex" code={latexCode} />
           </ResultCard>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex items-center gap-4 mb-8">
          <LogoIcon />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Geometry to LaTeX Agent</h1>
            <p className="text-slate-400">AI-powered analysis of geometric figures from images.</p>
          </div>
        </header>

        <main>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 shadow-lg">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <UploadIcon />
                Upload Image
              </h2>
              <ImageUploader 
                onImageUpload={handleImageUpload} 
                isProcessing={isPreprocessing}
                disabled={isPreprocessing || currentStep === 'ANALYZING' || currentStep === 'VERIFYING'} 
              />
              
              {image && (
                <button
                  onClick={processGeometry}
                  disabled={isPreprocessing || currentStep === 'ANALYZING' || currentStep === 'VERIFYING'}
                  className="mt-4 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-500 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  {isPreprocessing ? 'Preprocessing...' : (currentStep === 'ANALYZING' || currentStep === 'VERIFYING' ? 'Processing...' : 'Analyze Geometry')}
                </button>
              )}
            </div>

            <div className="lg:col-span-2 bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
              <h2 className="text-xl font-semibold text-white mb-4">Analysis Pipeline</h2>
              <StepDisplay currentStep={currentStep} error={error} />
              
              {processedImage && currentStep === 'READY' && (
                <div className="mt-6">
                  <ResultCard title="0. Preprocessed Image for Analysis">
                    <div className="bg-white rounded-lg p-4 flex justify-center items-center">
                      <img 
                        src={`data:image/png;base64,${processedImage}`} 
                        alt="Preprocessed for analysis"
                        className="max-w-full h-auto"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">This enhanced image (grayscale, blurred, edge-detected) is sent to the AI to improve accuracy.</p>
                  </ResultCard>
                </div>
              )}

              {(currentStep === 'IDLE' && !processedImage) && !error && (
                <div className="text-center text-slate-400 py-16">
                  <p className="text-lg">Upload an image and click "Analyze Geometry" to begin.</p>
                  <p>The results of each processing step will appear here.</p>
                </div>
              )}
              
              {renderResults()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
