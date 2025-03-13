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
  return `${monthName} ${displayDay}, ${year}`; // Matches prototype format
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

// Generate SVG with adjusted logo position
function generateSVG(issueDate, markdownContent) {
  const svgWidth = 500;  // Prototype width in pixels
  const svgHeight = 706; // A3 height in pixels (500 * 420/297 ≈ 706)
  
  let svg = `<svg id="week-in-ethereum-news" width="${svgWidth}" height="${svgHeight}" fill="none" xmlns="http://www.w3.org/2000/svg">`;
  
  // Larger blue rectangle
  svg += `<rect x="20" y="20" width="460" height="666" rx="20" fill="#454A75"/>`;
  
  // Process markdown content (wienText styling)
  const html = md.render(markdownContent);
  const $ = cheerio.load(html);
  
  let yPos = 50; // Starting y-position from prototype, within new rect
  const lineHeight = 10; // Matches prototype spacing
  const marginLeft = 42; // Matches h2/h3 x position
  const maxWidth = 436; // 500 - 42 - 22 (adjusted right margin for new rect width)
  const charsPerLine = Math.floor(maxWidth / 5); // Rough estimate for 8px font
  const maxY = 20 + 666; // Bottom of the blue rectangle (686)

  // Track rendered text to avoid duplicates
  const renderedText = new Set();

  const processBlockElement = (el) => {
    let fontSize = '8px'; // .tiny class from prototype
    let fontWeight = 'normal';
    let prefix = '';
    let xOffset = marginLeft;

    switch (el.tagName) {
      case 'h1': // Not explicitly styled in prototype, using h2
      case 'h2':
        fontSize = '12px'; // .h2 class
        fontWeight = 'normal'; // Prototype doesn't use bold
        break;
      case 'h3':
        fontSize = '10px'; // .h3 class
        fontWeight = 'normal';
        break;
      case 'li':
        prefix = '* '; // Prototype uses asterisk
        xOffset = 50; // Matches prototype indent
        break;
      case 'p':
        xOffset = 50; // Matches prototype indent for text
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

    // Wrap text and render, truncating if exceeding maxY
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

    // Render each line up to maxY
    const maxLines = Math.floor((maxY - yPos) / lineHeight);
    for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
      const line = lines[i];
      if (!line.text || renderedText.has(line.text)) continue;
      renderedText.add(line.text);
      svg += `<text x="${xOffset}" y="${yPos + (i * lineHeight)}" `;
      svg += `font-size="${fontSize}" font-family="Courier New" fill="#ffffff" opacity="0.15" `;
      svg += `font-weight="${line.bold || fontWeight === 'bold' ? 'bold' : 'normal'}" `;
      svg += `text-decoration="${line.underline ? 'underline' : 'none'}">${escapeXML(line.text)}</text>`;
    }

    // Update yPos based on rendered lines
    yPos += Math.min(lines.length, maxLines) * lineHeight + 2;
    if (yPos > maxY) yPos = maxY; // Cap yPos at maxY
  };

  $('h1, h2, h3, p, li').each((i, el) => processBlockElement(el));

  // Published date centered in the middle
  const centerY = svgHeight / 2; // Center of full SVG height (706 / 2 = 353)
  const dateParts = formatDisplayDate(issueDate).split(', ');
  svg += `<text fill="#ffffff" font-family="Calibri" font-size="70" font-weight="300">`;
  svg += `<tspan x="47.009" y="${centerY - 35}">${dateParts[0]},</tspan>`;
  svg += `<tspan x="177.989" y="${centerY + 35}">${dateParts[1]}</tspan>`;
  svg += `</text>`;

  // Ethereum logo and "Week in Ethereum News" inline at bottom
  const bottomY = 660; // Set y-value for text to 660
  svg += `
    <g transform="translate(20, 300) scale(0.8)">
      <path d="m64.496 411-.317 1.076v31.228l.317.316 14.495-8.568L64.496 411Z" stroke="#fff" stroke-width=".866" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M64.496 411 50 435.052l14.496 8.568V411Zm0 35.365-.179.218v11.124l.179.521L79 437.801l-14.504 8.564Z" stroke="#fff" stroke-width=".866" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M64.496 458.228v-11.863L50 437.801l14.496 20.427Zm0-14.608 14.495-8.568-14.495-6.589v15.157ZM50 435.052l14.496 8.568v-15.157L50 435.052Z" stroke="#fff" stroke-width=".866" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  `;
  svg += `<text fill="#ffffff" font-family="Calibri" font-size="36" x="88.195" y="${bottomY}">Week in Ethereum News</text>`;

  // Add styles from prototype
  svg += `
    <style>
      .wienText {font-family: "Courier New"; fill: white; opacity: .15;}
      .h2 {font-size: 12px;}
      .h3 {font-size: 10px;}
      .tiny {font-size: 8px;}
      .link {text-decoration: underline;}
    </style>
  `;

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