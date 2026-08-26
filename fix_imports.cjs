const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(
  /import \{ Play, Pause, Download, ChevronLeft, Loader2, RefreshCw \} from 'lucide-react';/,
  "import { Play, Pause, Download, ChevronLeft, Loader2, RefreshCw, Settings2, PanelRightClose } from 'lucide-react';"
);

fs.writeFileSync('src/components/Editor.tsx', code);
