const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

code = code.replace(
  "formData.append('video', currentProject.videoBlob);",
  "formData.append('video', currentProject.videoBlob, 'upload_video.mp4');"
);

fs.writeFileSync('src/components/Editor.tsx', code);
