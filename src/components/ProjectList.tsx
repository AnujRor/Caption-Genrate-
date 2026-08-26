import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { getProjects, saveProject, deleteProject } from '../lib/db';
import { Plus, Video, Trash2, Clock, Upload } from 'lucide-react';
import { formatTime } from '../lib/utils';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
}

export default function ProjectList({ onSelectProject }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: file.name.replace(/\.[^/.]+$/, ""),
      videoBlob: file,
      phrases: [],
      styles: {
        fontFamily: "'Montserrat', sans-serif",
        fontSize: 42,
        textColor: '#ffffff',
        highlightColor: '#facc15', // Vibrant Gold
        strokeColor: '#000000',
        strokeWidth: 3,
        positionY: 72,
        syncOffset: 0,
        displayMode: 'single-word', // 1-Word Pop by default
        animationStyle: 'pop',
      },
      createdAt: Date.now(),
    };

    try {
      await saveProject(newProject);
      await loadProjects();
      onSelectProject(newProject);
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project. Ensure you have enough storage space.');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (true) {
      await deleteProject(id);
      await loadProjects();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight">AutoCaption <span className="text-slate-500 font-normal">Pro</span></h1>
            <p className="text-slate-400">Generate AI captions for your videos instantly.</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white transition-colors px-6 py-3 rounded-md font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/20"
          >
            <Plus size={20} />
            New Project
          </button>
          <input 
            type="file" 
            accept="video/*" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            Loading your projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-32 border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/20">
            <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-500">
              <Upload size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
            <p className="text-slate-500 mb-8 max-w-sm mx-auto">Upload a video to start generating stylish captions powered by AI.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white transition-colors px-6 py-3 rounded-md font-medium shadow-lg shadow-indigo-600/20"
            >
              Upload Video
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div 
                key={project.id}
                onClick={() => onSelectProject(project)}
                className="group relative bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-all cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                <div className="aspect-video bg-black relative flex items-center justify-center">
                  <Video size={48} className="text-slate-800" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent opacity-80" />
                </div>
                <div className="p-5 relative">
                  <h3 className="font-semibold text-lg mb-1 truncate pr-8 text-slate-200">{project.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Clock size={14} />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <button 
                    onClick={(e) => handleDelete(e, project.id)}
                    className="absolute right-4 top-5 p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
