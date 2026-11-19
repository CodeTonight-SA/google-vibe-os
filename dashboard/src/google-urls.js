// Links to Google's own pages. The main process opens them in the user's
// browser and names the connected account (electron/google-links.js).

/** The Gmail conversation that a dashboard mail belongs to. */
export function gmailUrl(email) {
    return `https://mail.google.com/mail/#inbox/${encodeURIComponent(email.threadId || email.id)}`;
}

/** 'document', 'spreadsheet' or 'presentation': the label a dashboard file gets. */
export function docType(mimeType) {
    const type = mimeType || '';
    if (type.includes('document')) return 'document';
    if (type.includes('spreadsheet')) return 'spreadsheet';
    if (type.includes('presentation')) return 'presentation';
    return 'document';
}

const EDITOR_PATH = { document: 'document', spreadsheet: 'spreadsheets', presentation: 'presentation' };

/** A Google Doc, Sheet or Slides deck in its editor. Google shows it read-only to a viewer. */
export function docUrl(id, mimeType) {
    return `https://docs.google.com/${EDITOR_PATH[docType(mimeType)]}/d/${encodeURIComponent(id)}/edit`;
}
