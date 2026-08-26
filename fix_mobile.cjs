const fs = require('fs');
let code = fs.readFileSync('src/components/Editor.tsx', 'utf8');

// 1. Change object-contain to object-cover in video preview
code = code.replace(
  /className="w-full h-full object-contain"/g,
  'className="w-full h-full object-cover"'
);

// 2. Change export logic to crop to 9:16
const exportStartRegex = /const MAX_HEIGHT = 720;\s*let targetWidth = video\.videoWidth;\s*let targetHeight = video\.videoHeight;\s*if \(targetHeight > MAX_HEIGHT\) \{[\s\S]*?canvas\.height = targetHeight;/;

const newExportLogic = `const MAX_HEIGHT = 1280; // 9:16 max height
      let targetHeight = Math.min(video.videoHeight, MAX_HEIGHT);
      let targetWidth = Math.round(targetHeight * (9 / 16));
      
      canvas.width = targetWidth;
      canvas.height = targetHeight;`;

code = code.replace(exportStartRegex, newExportLogic);

// 3. Change drawImage to crop the video to 9:16
const drawImageRegex = /ctx\.drawImage\(video, 0, 0, canvas\.width, canvas\.height\);/;
const newDrawImage = `
        // Calculate crop to center the video in 9:16
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        let drawX = 0, drawY = 0, drawW = canvas.width, drawH = canvas.height;
        let sourceX = 0, sourceY = 0, sourceW = video.videoWidth, sourceH = video.videoHeight;
        
        if (videoRatio > canvasRatio) {
           // Video is wider, crop sides
           sourceW = video.videoHeight * canvasRatio;
           sourceX = (video.videoWidth - sourceW) / 2;
        } else {
           // Video is taller, crop top/bottom
           sourceH = video.videoWidth / canvasRatio;
           sourceY = (video.videoHeight - sourceH) / 2;
        }
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, sourceX, sourceY, sourceW, sourceH, drawX, drawY, drawW, drawH);
`;

code = code.replace(drawImageRegex, newDrawImage);

fs.writeFileSync('src/components/Editor.tsx', code);
