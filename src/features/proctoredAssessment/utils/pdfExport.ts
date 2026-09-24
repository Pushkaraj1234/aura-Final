import { jsPDF } from 'jspdf';
import { Pcl5ResultSummary, ProctorEvent } from '../types';
import { INTEGRITY_LABELS, formatEventType, stripMarkdown } from './labels';

interface ExportPdfOptions {
  summary: Pcl5ResultSummary;
  indexTraumaLabel: string;
  userReportText: string;
  sessionReportText: string;
  events: ProctorEvent[];
  participantId: string;
  /** ISO date the assessment was completed; defaults to now */
  date?: string;
}

export function exportAssessmentReportToPdf({
  summary,
  indexTraumaLabel,
  userReportText,
  sessionReportText,
  events,
  participantId,
  date,
}: ExportPdfOptions) {
  const completedAt = date ? new Date(date) : new Date();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  const dateLabel = completedAt.toLocaleDateString(undefined, { dateStyle: 'long' });
  let y = margin;

  const drawRunningHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 118, 110);
    doc.text('Aura', margin, y);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(`${participantId || 'Participant'} · ${dateLabel}`, pageWidth - margin, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, margin + contentWidth, y);
    y += 6;
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
      drawRunningHeader();
    }
  };

  const heading = (text: string) => {
    checkPageBreak(14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(text, margin, y);
    y += 6;
  };

  const paragraph = (text: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(stripMarkdown(text), contentWidth);
    lines.forEach((line: string) => {
      checkPageBreak(5);
      doc.text(line, margin, y);
      y += 4.6;
    });
    y += 4;
  };

  // 1. Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(19, 78, 74);
  doc.text('Trauma screening results', margin, y + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${dateLabel} · ${participantId || 'Participant'}`, margin, y + 11);
  if (indexTraumaLabel) {
    doc.text(`Questions referred to: ${indexTraumaLabel}`, margin, y + 16);
  }
  y += 26;

  // 2. Score
  heading('PCL-5 score');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text(`${summary.totalScore} / 80`, margin, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    summary.isClinicallySignificant
      ? `Above the screening threshold of ${summary.cutPoint}`
      : `Below the screening threshold of ${summary.cutPoint}`,
    margin + 40,
    y + 1
  );
  doc.text(`Effect on daily life: average ${summary.functionalImpactAverage.toFixed(1)} of 4`, margin + 40, y + 6);
  y += 14;

  // 3. Symptom areas
  heading('Symptom areas');
  const clusters = [
    { label: 'Intrusion', c: summary.clusters.B },
    { label: 'Avoidance', c: summary.clusters.C },
    { label: 'Thoughts and mood', c: summary.clusters.D },
    { label: 'Arousal and reactivity', c: summary.clusters.E },
  ];
  clusters.forEach(({ label, c }, index) => {
    const rowY = y + index * 7;
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, rowY - 4.5, contentWidth, 7, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(label, margin + 3, rowY);
    doc.text(`${c.score} / ${c.maxScore}`, margin + contentWidth - 55, rowY);
    doc.setTextColor(100, 116, 139);
    doc.text(c.symptomSeverity, margin + contentWidth - 25, rowY);
  });
  y += clusters.length * 7 + 6;

  // 4. Plain-language summary
  if (userReportText) {
    heading('What this means');
    paragraph(userReportText);
  }

  // 5. Session record
  heading('Session record');
  const integrity = INTEGRITY_LABELS[summary.sessionIntegrityRating];
  const stats = summary.sensorStats;
  paragraph(
    `${integrity.label}. ${integrity.description}` +
      (stats
        ? ` Face in view ${stats.faceRetentionPercentage}% of the time. In the assessment window ${stats.windowFocusPercentage}% of the time, with ${stats.tabSwitchCount} tab switches. Window monitoring: ${
            stats.screenShareType === 'display_stream' ? 'screen sharing' : 'focus tracking'
          }.`
        : ' Detailed camera and microphone figures were not recorded.')
  );
  if (sessionReportText) paragraph(sessionReportText);

  // 6. Events
  if (events && events.length > 0) {
    checkPageBreak(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(`Events (${events.length})`, margin, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    events.slice(0, 15).forEach((ev) => {
      const line = `${new Date(ev.timestamp).toLocaleTimeString()}  ${formatEventType(ev.eventType)}: ${ev.message}`;
      doc.splitTextToSize(line, contentWidth - 2).forEach((l: string) => {
        checkPageBreak(5);
        doc.text(l, margin + 2, y);
        y += 4.2;
      });
    });
    if (events.length > 15) {
      checkPageBreak(5);
      doc.text(`${events.length - 15} more events not shown.`, margin + 2, y);
      y += 5;
    }
  }

  // 7. Disclaimer and support
  checkPageBreak(25);
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, margin + contentWidth, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const disclaimer =
    'The PCL-5 is a screening questionnaire, not a diagnosis. If you are in distress, call Tele MANAS on 14416 (free, confidential, 24 hours) or KIRAN on 1800-599-0019. In an emergency, call 112.';
  doc.splitTextToSize(disclaimer, contentWidth).forEach((l: string) => {
    doc.text(l, margin, y);
    y += 3.6;
  });

  const filename = `Aura_Results_${participantId ? participantId.replace(/[^a-zA-Z0-9_-]/g, '') : 'Session'}_${completedAt
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(filename);
}
