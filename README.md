# GeoLaTeX Agent

An intelligent web application that converts images of geometric diagrams into compilable LaTeX code using the TikZ library. Powered by Google Gemini API with advanced self-correction capabilities.

## Features

- 🖼️ **Image Upload**: Drag & drop or select geometric diagram images
- 🤖 **AI Analysis**: Google Gemini 2.5 Pro analyzes geometry structure
- 📝 **LaTeX Generation**: Automatic TikZ code generation
- ✅ **Self-Correction**: Validates and debugs generated LaTeX code
- 🎨 **Modern UI**: Clean interface with Tailwind CSS
- 📊 **Confidence Score**: AI confidence rating for analysis quality

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- Google Gemini API key

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
GeometryLatex/
├── src/                      # Source code
│   ├── App.tsx              # Main application component
│   ├── index.tsx            # Entry point
│   ├── types.ts             # TypeScript type definitions
│   ├── components/          # React components
│   │   ├── CodeBlock.tsx
│   │   ├── icons.tsx
│   │   ├── ImageUploader.tsx
│   │   ├── ResultCard.tsx
│   │   └── StepDisplay.tsx
│   └── services/            # Business logic
│       ├── errorService.ts
│       ├── geminiService.ts
│       ├── imageProcessing.ts
│       └── latexCompilerService.ts
├── public/                  # Static assets
│   └── images/             # Test images
├── docs/                   # Documentation
├── dist/                   # Build output
└── index.html             # HTML entry point
```

## How It Works

## How It Works

1. **Image Upload & Preprocessing**
   - Upload geometric diagram image
   - Intelligent border detection and cropping
   - Adaptive grayscale conversion and binarization

2. **AI Geometry Analysis**
   - Gemini 2.5 Pro analyzes the image
   - Extracts vertices, lines, and annotations
   - Returns structured JSON with bounding box and confidence score

3. **LaTeX Code Generation**
   - Gemini 2.5 Pro generates complete TikZ document
   - Includes all necessary packages and libraries
   - Properly formatted and human-readable

4. **Verification & Self-Correction**
   - Code sent to external LaTeX compiler
   - If errors occur, AI debugs and rewrites code
   - Repeats until successful compilation (up to 2 attempts)

5. **Display Results**
   - Shows isolated geometric figure
   - Displays confidence score
   - Provides copyable LaTeX code

## Technologies

- **Frontend**: React 19.2 with TypeScript
- **Build Tool**: Vite 6.2
- **AI**: Google Gemini API (@google/genai 1.27)
- **Styling**: Tailwind CSS (via CDN)
- **Image Processing**: HTML5 Canvas API
- **LaTeX Verification**: External compilation service

## Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key_here
```

## Documentation

See the `docs/` directory for detailed documentation:
- Implementation guides
- Testing procedures
- Troubleshooting tips
- Feature enhancements

## License

This project is for educational and research purposes.