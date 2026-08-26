import React, { useState } from 'react';
import ProjectList from './components/ProjectList';
import Editor from './components/Editor';
import { Project } from './types';

export default function App() {
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  return (
    <>
      {activeProject ? (
        <Editor 
          project={activeProject} 
          onBack={() => setActiveProject(null)} 
        />
      ) : (
        <ProjectList 
          onSelectProject={setActiveProject} 
        />
      )}
    </>
  );
}
