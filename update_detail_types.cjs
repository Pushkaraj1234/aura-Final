const fs = require('fs');
let detail = fs.readFileSync('src/pages/ParticipantDetail.tsx', 'utf8');

detail = detail.replace('onAddNote: (participantId: string, note: SupportNote) => void;', 'onAddNote: (participantId: string, note: SupportNote) => void;\n  onDeleteNote?: (participantId: string, noteId: string) => void;');

detail = detail.replace('  onAddNote,\n  onOpenEmergency', '  onAddNote,\n  onDeleteNote,\n  onOpenEmergency');

detail = detail.replace('import {  ResponsiveContainer,', 'import { ConfirmDialog } from "../components/ConfirmDialog";\nimport {  ResponsiveContainer,');

fs.writeFileSync('src/pages/ParticipantDetail.tsx', detail);
console.log("Updated ParticipantDetail types");
