const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

// Add state
code = code.replace(
  "const [activeTab, setActiveTab] = useState<'captions' | 'style'>('captions');",
  "const [activeTab, setActiveTab] = useState<'captions' | 'style'>('captions');\n  const [isSidebarOpen, setIsSidebarOpen] = useState(true);"
);

// Auto close on generate
code = code.replace(
  "currentProject.phrases = phrases;\n      \n      // Force re-render",
  "currentProject.phrases = phrases;\n      \n      setIsSidebarOpen(false);\n      // Force re-render"
);

// Toggle button and sidebar wrapper
const sidebarStart = code.indexOf('{/* Sidebar */}');
const sidebarEnd = code.lastIndexOf('</div>\n    </div>\n  );\n}');

const sidebarReplacement = `
      {/* Sidebar Toggle Button (if closed) */}
      {!isSidebarOpen && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="absolute right-4 top-20 bg-slate-800 p-3 rounded-full text-white shadow-lg z-20 hover:bg-slate-700 transition-all border border-slate-700"
          title="Open Settings"
        >
          <Settings2 size={24} />
        </button>
      )}

      {/* Sidebar */}
      <div className={cn(
        "bg-slate-900 border-l border-slate-800 flex flex-col z-10 shrink-0 transition-all duration-300",
        isSidebarOpen ? "w-[320px]" : "w-0 overflow-hidden"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800 w-[320px]">
          <div className="flex flex-1 p-1 bg-slate-950 rounded-lg mr-2">
            <button 
              onClick={() => setActiveTab('captions')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === 'captions' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"
              )}
            >
              Captions
            </button>
            <button 
              onClick={() => setActiveTab('style')}
              className={cn(
                "flex-1 py-1.5 text-xs font-medium rounded-md transition-colors",
                activeTab === 'style' ? "bg-slate-800 text-white shadow-sm" : "text-slate-400 hover:text-slate-300"
              )}
            >
              Style
            </button>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white p-1">
             <PanelRightClose size={18} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 w-[320px]">
` + code.substring(code.indexOf('{activeTab === \'captions\' ? ('), sidebarEnd) + `
      </div>
    </div>
  );
}`;

code = code.substring(0, sidebarStart) + sidebarReplacement;

// Add icon imports
code = code.replace(
  "import { Download, Play, Pause, ChevronLeft, Loader2 } from 'lucide-react';",
  "import { Download, Play, Pause, ChevronLeft, Loader2, Settings2, PanelRightClose } from 'lucide-react';"
);

fs.writeFileSync('src/components/Editor.tsx', code);
