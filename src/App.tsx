import React, { useState } from 'react';
import ProjectList from './components/ProjectList';
import Editor from './components/Editor';
import ErrorBoundary from './components/ErrorBoundary';
import { Project } from './types';

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  return (
    <ErrorBoundary onReset={() => setActiveProject(null)}>
      {activeProject ? (
        <Editor key={activeProject.id} project={activeProject} onBack={() => setActiveProject(null)} />
      ) : (
        <ProjectList onSelectProject={setActiveProject} />
      )}
    </ErrorBoundary>
  );
}
