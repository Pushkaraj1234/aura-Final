const fs = require('fs');
let detail = fs.readFileSync('src/pages/ParticipantDetail.tsx', 'utf8');

const confirmState = `  const [activeScore, setActiveScore] = useState<number | null>(null);
  
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null);
`;
detail = detail.replace('  const [activeScore, setActiveScore] = useState<number | null>(null);', confirmState);

const noteRender = `                      <div className="flex items-center justify-between text-[10px] text-[#7F8C8D] font-bold">
                        <div className="flex space-x-2">
                          <span>{n.author}</span>
                          <span>{new Date(n.timestamp).toLocaleDateString()}</span>
                        </div>
                        {onDeleteNote && (
                          <button
                            onClick={() => setNoteToDelete(n.id)}
                            className="text-[#7F8C8D] hover:text-[#A55D25] transition-colors cursor-pointer"
                            title="Delete note"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>`;

detail = detail.replace(/<div className="flex items-center justify-between text-\[10px\] text-\[#7F8C8D\] font-bold">\s*<span>\{n\.author\}<\/span>\s*<span>\{new Date\(n\.timestamp\)\.toLocaleDateString\(\)\}<\/span>\s*<\/div>/, noteRender);

const regex = /    <\/div>\s*\);\s*\};\s*$/;
const confirmModal = `      {/* Delete Note Confirm */}
      <ConfirmDialog
        isOpen={!!noteToDelete}
        title="Delete Support Note"
        message="Are you sure you want to delete this case note? This action cannot be undone and will be logged in the audit trail."
        confirmText="Delete Note"
        onConfirm={() => {
          if (noteToDelete && onDeleteNote) {
            onDeleteNote(participant.id, noteToDelete);
          }
          setNoteToDelete(null);
        }}
        onCancel={() => setNoteToDelete(null)}
      />
    </div>
  );
};
`;

detail = detail.replace(regex, confirmModal);
detail = detail.replace('import {  ResponsiveContainer,', 'import { Trash2 } from "lucide-react";\nimport {  ResponsiveContainer,');

fs.writeFileSync('src/pages/ParticipantDetail.tsx', detail);
console.log("Updated ParticipantDetail render");
