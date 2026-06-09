import { redirect } from 'next/navigation';

export default function RootPage() {
  // Auto-redirect to docs for now, or show TBD stub
  // redirect('/docs');

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
      <h1 className="text-4xl font-bold mb-4">Netlisian Platform</h1>
      <p className="text-xl text-gray-600 mb-8">
        The complete platform for collaborative visual development.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 max-w-md">
        <h2 className="text-lg font-semibold text-amber-800 mb-2">Coming Soon (TBD)</h2>
        <p className="text-amber-700">
          The platform layer is currently under active development. 
          Check out our <strong>Open Source</strong> documentation to get started with the engine.
        </p>
        <a 
          href="/docs" 
          className="mt-4 inline-block bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          Go to Documentation
        </a>
      </div>
    </div>
  );
}
