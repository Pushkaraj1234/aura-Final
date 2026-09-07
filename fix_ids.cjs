const fs = require('fs');
let content = fs.readFileSync('src/pages/SupportDashboard.tsx', 'utf8');

content = content.replace("onSelectParticipant('P-2291')", "onSelectParticipant('P-1053')");
content = content.replace("onSelectParticipant('P-1874')", "onSelectParticipant('P-1042')");

fs.writeFileSync('src/pages/SupportDashboard.tsx', content);
