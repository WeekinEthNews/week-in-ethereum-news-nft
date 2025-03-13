const fs = require('fs').promises;
const path = require('path');
const MarkdownIt = require('markdown-it');
const cheerio = require('cheerio');

// Initialize markdown parser
const md = new MarkdownIt();

// Directories
const archiveDir = './archive';
const imagesDir = './images';

// Month name mappings
const monthMap = {
  'january': '01', 'february': '02', 'march': '03', 'april': '04',
  'may': '05', 'june': '06', 'july': '07', 'august': '08',
  'september': '09', 'october': '10', 'november': '11', 'december': '12'
};
const monthNameMap = Object.fromEntries(
  Object.entries(monthMap).map(([name, num]) => [num, name.charAt(0).toUpperCase() + name.slice(1)])
);

// Ensure directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Parse date from filename
function parseDateFromFilename(filename) {
  const match = filename.match(/week-in-ethereum-news-([a-z]+)-(\d{1,2})-(\d{4})\.md$/i);
  if (!match) return null;
  const [_, monthWord, day, year] = match;
  const month = monthMap[monthWord.toLowerCase()];
  if (!month) return null;
  const paddedDay = day.length === 1 ? `0${day}` : day;
  return `${year}-${month}-${paddedDay}`;
}

// Format dates
function formatDisplayDate(issueDate) {
  const [year, monthNum, day] = issueDate.split('-');
  const monthName = monthNameMap[monthNum];
  const displayDay = parseInt(day, 10);
  return `${monthName} ${displayDay} ${year}`;
}

// Escape special XML characters
function escapeXML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Generate SVG matching the prototype
function generateSVG(issueDate, markdownContent) {
  const svgWidth = '210mm';  // A4 width
  const svgHeight = '297mm'; // A4 height
  
  let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">`;
  
  // White background
  svg += '<rect width="100%" height="100%" fill="#ffffff"/>';
  
  // Dark blue header bar (20mm height)
  svg += '<rect x="0" y="0" width="100%" height="20mm" fill="#1c2526"/>';
  
  // Title in header
  const title = `Week in Ethereum News - ${formatDisplayDate(issueDate)}`;
  svg += `<text x="50%" y="15mm" font-size="14pt" text-anchor="middle" font-family="Arial" fill="#ffffff" font-weight="bold">${escapeXML(title)}</text>`;
  
  // Process markdown content
  const html = md.render(markdownContent);
  const $ = cheerio.load(html);
  
  let yPos = 25; // Starting y-position below header in mm
  const lineHeight = 5; // mm (adjusted for tighter spacing)
  const marginLeft = 10; // mm (left margin)
  const maxWidth = 190; // mm (210mm - 10mm left - 10mm right)
  const charsPerLine = Math.floor(maxWidth / 2); // Rough estimate, adjusted for smaller font

  // Track rendered text to avoid duplicates
  const renderedText = new Set();

  const processBlockElement = (el) => {
    let fontSize = '8pt'; // Default from prototype
    let fontWeight = 'normal';
    let prefix = '';

    switch (el.tagName) {
      case 'h1':
        fontSize = '12pt';
        fontWeight = 'bold';
        break;
      case 'h2':
        fontSize = '10pt';
        fontWeight = 'bold';
        break;
      case 'h3':
        fontSize = '9pt';
        fontWeight = 'bold';
        break;
      case 'li':
        prefix = '• ';
        break;
    }

    // Process inline content
    const parts = [];
    const processInline = (node, parentBold = false, parentUnderline = false) => {
      if (node.type === 'text') {
        const text = node.data.trim();
        if (text) {
          parts.push({
            text,
            bold: parentBold,
            underline: parentUnderline
          });
        }
      } else if (node.type === 'tag') {
        const isBold = node.name === 'strong' || parentBold;
        const isUnderline = node.name === 'a' || parentUnderline;
        $(node).contents().each((_, child) => {
          processInline(child, isBold, isUnderline);
        });
      }
    };

    $(el).contents().each((_, child) => processInline(child));
    if (parts.length === 0) {
      const text = $(el).text().trim();
      if (text && !renderedText.has(text)) {
        parts.push({ text, bold: fontWeight === 'bold', underline: false });
        renderedText.add(text);
      }
    }

    if (prefix && parts.length > 0) {
      parts[0].text = prefix + parts[0].text;
    }

    // Wrap text and render
    let currentLine = '';
    let lines = [];

    for (const part of parts) {
      if (renderedText.has(part.text)) continue;
      const words = part.text.split(' ');
      for (const word of words) {
        if ((currentLine + word).length > charsPerLine) {
          lines.push({ text: currentLine.trim(), bold: part.bold, underline: part.underline });
          currentLine = word + ' ';
        } else {
          currentLine += word + ' ';
        }
      }
    }
    if (currentLine) {
      lines.push({ text: currentLine.trim(), bold: parts[parts.length - 1].bold, underline: parts[parts.length - 1].underline });
    }

    // Render each line
    lines.forEach((line, index) => {
      if (!line.text || renderedText.has(line.text)) return;
      renderedText.add(line.text);
      svg += `<text x="${marginLeft}mm" y="${yPos + (index * lineHeight)}mm" `;
      svg += `font-size="${fontSize}" font-family="Arial" fill="#000000" `;
      svg += `font-weight="${line.bold || fontWeight === 'bold' ? 'bold' : 'normal'}" `;
      svg += `text-decoration="${line.underline ? 'underline' : 'none'}">${escapeXML(line.text)}</text>`;
    });

    yPos += lines.length * lineHeight + 2; // 2mm extra spacing between blocks
  };

  $('h1, h2, h3, p, li').each((i, el) => processBlockElement(el));

  svg += '</svg>';
  return svg;
}

// Process a single markdown file for image
async function processImage(filePath, tokenID) {
  try {
    const filename = path.basename(filePath);
    const issueDate = parseDateFromFilename(filename);
    if (!issueDate) {
      console.error(`Invalid filename format: ${filename}`);
      return;
    }

    // Read markdown content
    const markdownContent = await fs.readFile(filePath, 'utf8');

    // Ensure images directory exists
    await ensureDir(imagesDir);

    // Generate SVG
    const svgContent = generateSVG(issueDate, markdownContent);
    const svgFileName = filename.replace('.md', '.svg');
    const svgPath = path.join(imagesDir, svgFileName);
    await fs.writeFile(svgPath, svgContent, 'utf8');

    console.log(`Generated image #${tokenID} for ${issueDate}`);
  } catch (err) {
    console.error(`Error processing image for ${filePath} with tokenID ${tokenID}:`, err);
  }
}

// Generate all images
async function generateImages() {
  try {
    await ensureDir(imagesDir);
    const files = await fs.readdir(archiveDir);
    const markdownFiles = files.filter(file => file.match(/week-in-ethereum-news-[a-z]+-\d{1,2}-\d{4}\.md$/i));

    console.log(`Found ${markdownFiles.length} markdown files to process for images.`);

    markdownFiles.sort((a, b) => {
      const dateA = parseDateFromFilename(a);
      const dateB = parseDateFromFilename(b);
      return dateA.localeCompare(dateB);
    });

    for (let tokenID = 1; tokenID <= markdownFiles.length; tokenID++) {
      const fileIndex = tokenID - 1;
      const filePath = path.join(archiveDir, markdownFiles[fileIndex]);
      await processImage(filePath, tokenID);
    }
    console.log(`Completed generating images for ${markdownFiles.length} NFTs.`);
  } catch (err) {
    console.error('Error in generateImages:', err);
  }
}

// Run the script
generateImages();