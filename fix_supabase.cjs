const fs = require('fs');
let content = fs.readFileSync('src/services/supabaseService.ts', 'utf8');

content = content.replace(
  'if (item.content !== undefined) payload.content = item.content;',
  '// if (item.content !== undefined) payload.content = item.content;'
);

content = content.replace(
  'if (updates.content !== undefined) payload.content = updates.content;',
  '// if (updates.content !== undefined) payload.content = updates.content;'
);

fs.writeFileSync('src/services/supabaseService.ts', content);
