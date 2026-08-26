const fs = require('fs');
fetch('http://localhost:3000/api/transcribe', {
  method: 'POST',
  body: 'test'
}).then(res => res.text()).then(console.log).catch(console.error);
