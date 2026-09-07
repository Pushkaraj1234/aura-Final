const fs = require('fs');
let content = fs.readFileSync('src/pages/SupportDashboard.tsx', 'utf8');

content = content.replace(
  '<button className="flex-1 py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] text-[11px] font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer">\n                Escalate\n              </button>',
  '<button onClick={() => onSelectParticipant(\'P-2291\')} className="flex-1 py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] text-[11px] font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer">\n                Escalate\n              </button>'
);

content = content.replace(
  '<button className="flex-1 py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] text-[11px] font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer">\n                Send check-in\n              </button>',
  '<button onClick={() => onSelectParticipant(\'P-1874\')} className="flex-1 py-2.5 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] text-[11px] font-bold hover:bg-[#FDF9F5] transition-colors cursor-pointer">\n                Send check-in\n              </button>'
);

fs.writeFileSync('src/pages/SupportDashboard.tsx', content);
