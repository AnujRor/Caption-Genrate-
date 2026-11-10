import React, { lazy, Suspense, useState } from 'react';
import ProjectList from './components/ProjectList';
import ErrorBoundary from './components/ErrorBoundary';
import { Project } from './types';
import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, useSeo } from './lib/seo';

// The editor (and its canvas renderer) is only needed after a video is opened,
// so keeping it out of the landing bundle makes the first paint faster.
const Editor = lazy(() => import('./components/Editor'));

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useSeo({
    title: activeProject ? `Caption Editor — ${activeProject.name} | AutoCaption Studio` : DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  });

  return (
    <ErrorBoundary onReset={() => setActiveProject(null)}>
      {activeProject ? (
        <Suspense
          fallback={
            <div className="flex h-[100dvh] items-center justify-center bg-ink-950 text-sm text-zinc-400">
              Loading editor…
            </div>
          }
        >
          <Editor key={activeProject.id} project={activeProject} onBack={() => setActiveProject(null)} />
        </Suspense>
      ) : (
        <ProjectList onSelectProject={setActiveProject} />
      )}
    </ErrorBoundary>
  );
}
