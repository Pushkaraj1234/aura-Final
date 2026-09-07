const fs = require('fs');
let vr = fs.readFileSync('src/components/VoiceRecorder.tsx', 'utf8');

const importConfirm = `import { ConfirmDialog } from "./ConfirmDialog";\nimport { CheckCircle2, Shield, Mic, Square, Play, Pause, Trash2, Edit3, RotateCcw } from "lucide-react";`;
vr = vr.replace('import { CheckCircle2, Shield, Mic, Square, Play, Pause, Trash2, Edit3, RotateCcw } from "lucide-react";', importConfirm);

vr = vr.replace('  const [isPlayingAudio, setIsPlayingAudio] = useState(false);', '  const [isPlayingAudio, setIsPlayingAudio] = useState(false);\n  const [showConfirmDelete, setShowConfirmDelete] = useState(false);');

vr = vr.replace('onClick={handleDeleteRecording}', 'onClick={() => setShowConfirmDelete(true)}');

const confirmModal = `      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Voice Recording"
        message="Are you sure you want to discard your voice recording? This cannot be undone."
        confirmText="Discard Recording"
        onConfirm={() => {
          handleDeleteRecording();
          setShowConfirmDelete(false);
        }}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}`;

vr = vr.replace(/    <\/div>\s*\);\s*\}/, confirmModal);

fs.writeFileSync('src/components/VoiceRecorder.tsx', vr);
console.log("Updated VoiceRecorder.tsx");
