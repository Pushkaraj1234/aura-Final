const fs = require('fs');
let types = fs.readFileSync('src/types/index.ts', 'utf8');
types = types.replace('calculatedScore?: number;', 'calculatedScore?: number;\n  aiComprehensiveAnalysis?: any;');
fs.writeFileSync('src/types/index.ts', types);
console.log("Updated types");
