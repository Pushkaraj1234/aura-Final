const fs = require('fs');
let checkin = fs.readFileSync('src/pages/ParticipantCheckin.tsx', 'utf8');

checkin = checkin.replace('let aiAnalysis = undefined;', `let aiAnalysis = undefined;
        let aiComprehensiveAnalysis = undefined;`);

const comprehensiveCall = `          try {
            const { apiService } = await import('../services/apiService');
            aiAnalysis = await apiService.ai.analyzeReflection(transcript);
            aiComprehensiveAnalysis = await apiService.ai.analyzeComprehensiveCheckIn(
              { wellbeing, stress: computedStress, sleep, safety, connection, supportRequested, immediateSafetyConcern: isSafetyConcern },
              transcript
            );
          } catch (e) {
            console.warn("Gemini AI Analysis Failed, falling back to deterministic:", e);
          }`;

checkin = checkin.replace(`          try {
            const { apiService } = await import('../services/apiService');
            aiAnalysis = await apiService.ai.analyzeReflection(transcript);
          } catch (e) {
            console.warn("Gemini AI Analysis Failed, falling back to deterministic:", e);
          }`, comprehensiveCall);

const reflectionObj = `        const newCheckIn: CheckIn = {
          id: \`c-\${Date.now()}-\${Math.random().toString(36).substring(2, 7)}\`,
          participantId,
          timestamp: new Date().toISOString(),
          wellbeing,
          stress: computedStress,
          sleep,
          safety,
          connection,
          supportRequested,
          immediateSafetyConcern: isSafetyConcern,
          notes: compiledNotes || transcript || undefined,
          voiceInputUsed: currentReflection?.type === "voice" || currentReflection?.audioRecorded,
          shareNoteWithWorker: currentReflection ? currentReflection.shareWithWorker : true,
          reflection: updatedReflection,
          aiComprehensiveAnalysis
        };`;

checkin = checkin.replace(/const newCheckIn: CheckIn = \{[\s\S]*?reflection: updatedReflection\n\s*\};/, reflectionObj);

fs.writeFileSync('src/pages/ParticipantCheckin.tsx', checkin);
console.log("Updated ParticipantCheckin.tsx");
